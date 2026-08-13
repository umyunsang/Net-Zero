import './load-env.js';
import { S3Client } from '@aws-sdk/client-s3';
import { run } from 'graphile-worker';
import pg from 'pg';
import { createTasks } from './jobs.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const storage = new S3Client({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
  region: process.env.OBJECT_STORAGE_REGION ?? 'ap-southeast-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY ?? '',
    secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY ?? '',
  },
});

const runner = await run({
  connectionString: databaseUrl,
  concurrency: 2,
  pollInterval: 1_000,
  taskList: createTasks({
    pool,
    storage,
    bucket: process.env.OBJECT_STORAGE_BUCKET ?? 'net-zero-evidence',
  }),
  crontab: `
    */5 * * * * evaluate-blocked-claims
    0 * * * * expire-vouchers
    5 * * * * purge-orphan-uploads
    10 * * * * purge-expired-evidence
    */15 * * * * rebuild-weekly-projections
  `,
});

let stopping: Promise<void> | undefined;
function shutdown(): Promise<void> {
  stopping ??= (async () => {
    await runner.stop();
    await pool.end();
  })();
  return stopping;
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown().catch((error: unknown) => {
      console.error('Worker shutdown failed', error);
      process.exitCode = 1;
    });
  });
}
