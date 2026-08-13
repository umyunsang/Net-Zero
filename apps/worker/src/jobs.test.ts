import { DeleteObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type pg from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { createTasks } from './jobs.js';

type QueryResult = { rows: unknown[] };

function taskRunner(tasks: ReturnType<typeof createTasks>, name: string) {
  const task = tasks[name];
  if (!task) throw new Error(`missing task ${name}`);
  return (payload: unknown = {}) => task(payload, {} as never);
}

describe('worker jobs', () => {
  it('delegates blocked-impact evaluation to the database authority and validates payloads', async () => {
    const query = vi.fn(async (): Promise<QueryResult> => ({ rows: [] }));
    const tasks = createTasks({ pool: { query } as unknown as pg.Pool, storage: {} as S3Client, bucket: 'evidence' });
    await expect(taskRunner(tasks, 'evaluate-blocked-claim-impact')({})).rejects.toThrow('requires a claimId');
    await taskRunner(tasks, 'evaluate-blocked-claim-impact')({ claimId: 'claim-1' });
    expect(query).toHaveBeenCalledWith('SELECT evaluate_blocked_claim_impact($1)', ['claim-1']);
  });

  it('expires issued vouchers without writing a refund', async () => {
    const query = vi.fn(async (): Promise<QueryResult> => ({ rows: [] }));
    const tasks = createTasks({ pool: { query } as unknown as pg.Pool, storage: {} as S3Client, bucket: 'evidence' });
    await taskRunner(tasks, 'expire-vouchers')();
    const statement = String((query.mock.calls as unknown[][])[0]?.[0]);
    expect(statement).toContain("SET state = 'expired'");
    expect(statement).not.toContain('point_ledger');
    expect(statement).not.toContain('refund');
  });

  it('tombstones an expired evidence object only after storage deletion succeeds', async () => {
    const clientQuery = vi.fn(async (statement: string): Promise<QueryResult> => {
      if (statement.includes('SELECT object_key FROM evidence')) return { rows: [{ object_key: 'evidence/object-1' }] };
      return { rows: [] };
    });
    const client = { query: clientQuery, release: vi.fn() };
    const poolQuery = vi.fn(async (): Promise<QueryResult> => ({ rows: [{ id: 'evidence-1' }] }));
    const send = vi.fn(async (command: unknown) => {
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      return {};
    });
    const tasks = createTasks({
      pool: { query: poolQuery, connect: vi.fn(async () => client) } as unknown as pg.Pool,
      storage: { send } as unknown as S3Client,
      bucket: 'evidence',
    });
    await taskRunner(tasks, 'purge-expired-evidence')();
    expect(clientQuery.mock.calls.map(call => call[0])).toEqual([
      'BEGIN',
      expect.stringContaining('SELECT object_key FROM evidence'),
      expect.stringContaining('UPDATE evidence'),
      expect.stringContaining('UPDATE upload_sessions'),
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back an evidence purge when object deletion fails', async () => {
    const clientQuery = vi.fn(async (statement: string): Promise<QueryResult> => {
      if (statement.includes('SELECT object_key FROM evidence')) return { rows: [{ object_key: 'evidence/object-2' }] };
      return { rows: [] };
    });
    const client = { query: clientQuery, release: vi.fn() };
    const tasks = createTasks({
      pool: {
        query: vi.fn(async (): Promise<QueryResult> => ({ rows: [{ id: 'evidence-2' }] })),
        connect: vi.fn(async () => client),
      } as unknown as pg.Pool,
      storage: { send: vi.fn(async () => { throw new Error('storage unavailable'); }) } as unknown as S3Client,
      bucket: 'evidence',
    });
    await expect(taskRunner(tasks, 'purge-expired-evidence')()).rejects.toThrow('storage unavailable');
    expect(clientQuery.mock.calls.map(call => call[0])).toEqual([
      'BEGIN',
      expect.stringContaining('SELECT object_key FROM evidence'),
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rebuilds real and demo Bangkok projections as separate scopes', async () => {
    const query = vi.fn(async (): Promise<QueryResult> => ({ rows: [] }));
    const tasks = createTasks({ pool: { query } as unknown as pg.Pool, storage: {} as S3Client, bucket: 'evidence' });
    await taskRunner(tasks, 'rebuild-weekly-projections')();
    expect(query).toHaveBeenCalledTimes(2);
    const calls = query.mock.calls as unknown[][];
    expect(String(calls[0]?.[0])).toContain('false');
    expect(String(calls[1]?.[0])).toContain('true');
  });
});
