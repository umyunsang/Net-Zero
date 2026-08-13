import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { TaskList } from 'graphile-worker';
import type pg from 'pg';

interface WorkerDependencies {
  pool: pg.Pool;
  storage: S3Client;
  bucket: string;
}

interface ClaimPayload { claimId: string }

function isClaimPayload(value: unknown): value is ClaimPayload {
  return typeof value === 'object' && value !== null && typeof (value as { claimId?: unknown }).claimId === 'string';
}

export function createTasks({ pool, storage, bucket }: WorkerDependencies): TaskList {
  async function deleteObject(objectKey: string): Promise<void> {
    await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
  }

  return {
    async 'evaluate-blocked-claim-impact'(payload) {
      if (!isClaimPayload(payload)) {
        throw new Error('evaluate-blocked-claim-impact requires a claimId');
      }

      // The database function owns locking, approved-factor selection, one-credit
      // constraints, calculation snapshots, carbon entries, and point entries.
      await pool.query('SELECT evaluate_blocked_claim_impact($1)', [payload.claimId]);
    },

    async 'evaluate-blocked-claims'() {
      const claims = await pool.query<{ id: string }>(
        `SELECT id FROM claims
         WHERE state='verified' AND impact_status='blocked_factor_approval'
         ORDER BY submitted_at`,
      );
      for (const claim of claims.rows) {
        await pool.query('SELECT evaluate_blocked_claim_impact($1)', [claim.id]);
      }
    },

    async 'expire-vouchers'() {
      // Expiry is deliberately a state change only: no refund ledger entry is made.
      await pool.query(`
        UPDATE vouchers
        SET state = 'expired'
        WHERE state = 'issued' AND expires_at <= now()
      `);
    },

    async 'purge-orphan-uploads'() {
      const candidates = await pool.query<{ id: string }>(`
        SELECT us.id
        FROM upload_sessions us
        WHERE us.state IN ('draft','failed','revoked','uploaded')
          AND us.orphan_eligible_at <= now()
          AND NOT EXISTS (SELECT 1 FROM evidence e WHERE e.upload_session_id = us.id)
      `);

      for (const candidate of candidates.rows) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const locked = await client.query<{ object_key: string }>(
            `SELECT object_key FROM upload_sessions
             WHERE id=$1 AND state IN ('draft','failed','revoked','uploaded')
               AND orphan_eligible_at <= now()
               AND NOT EXISTS (SELECT 1 FROM evidence WHERE upload_session_id=$1)
             FOR UPDATE`,
            [candidate.id],
          );
          const row = locked.rows[0];
          if (row) {
            await deleteObject(row.object_key);
            await client.query(
              `UPDATE upload_sessions
               SET state='tombstoned',tombstoned_at=now(),upload_token_hash=null,
                   object_key='tombstoned/' || id::text,content_type=null,byte_size=null,
                   expected_sha256=null,captured_at=null,camera_make=null,camera_model=null,
                   latitude=null,longitude=null
               WHERE id=$1`,
              [candidate.id],
            );
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }
    },

    async 'purge-expired-evidence'() {
      const candidates = await pool.query<{ id: string }>(`
        SELECT e.id
        FROM evidence e
        WHERE e.deleted_at IS NULL
          AND e.expires_at IS NOT NULL
          AND e.expires_at <= now()
      `);

      for (const candidate of candidates.rows) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const locked = await client.query<{ object_key: string }>(
            `SELECT object_key FROM evidence
             WHERE id=$1 AND deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at<=now()
             FOR UPDATE`,
            [candidate.id],
          );
          const row = locked.rows[0];
          if (row) {
            await deleteObject(row.object_key);
            await client.query(
              `UPDATE evidence
               SET deleted_at=now(),tombstoned_at=now(),object_key='tombstoned/' || id::text,
                   content_type=null,sha256=null,captured_at=null,location=null
               WHERE id=$1`,
              [candidate.id],
            );
            await client.query(
              `UPDATE upload_sessions
               SET state='tombstoned',tombstoned_at=now(),object_key='tombstoned/' || id::text,
                   content_type=null,byte_size=null,expected_sha256=null,captured_at=null,
                   camera_make=null,camera_model=null,latitude=null,longitude=null
               WHERE evidence_id=$1`,
              [candidate.id],
            );
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }
    },

    async 'rebuild-weekly-projections'() {
      // The projections intentionally carry avoided and projected impact in distinct columns.
      await pool.query(`
        SELECT rebuild_bangkok_weekly_projections(
          (date_trunc('week', now() AT TIME ZONE 'Asia/Bangkok'))::date,
          false
        )
      `);
      await pool.query(`
        SELECT rebuild_bangkok_weekly_projections(
          (date_trunc('week', now() AT TIME ZONE 'Asia/Bangkok'))::date,
          true
        )
      `);
    },
  };
}
