import '../load-env.js';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sql, type Kysely } from 'kysely';
import { createDatabase, type Database } from './db.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../migrations/', import.meta.url));

export async function migrate(database: Kysely<Database>, directory = migrationsDirectory): Promise<string[]> {
  await sql`create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )`.execute(database);

  const filenames = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  const applied: string[] = [];

  for (const filename of filenames) {
    await database.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom('schema_migrations')
        .select('filename')
        .where('filename', '=', filename)
        .executeTakeFirst();
      if (existing) return;

      const migration = await readFile(`${directory}/${filename}`, 'utf8');
      await sql.raw(migration).execute(trx);
      await trx
        .insertInto('schema_migrations')
        .values({ filename, applied_at: new Date() })
        .execute();
      applied.push(filename);
    });
  }

  return applied;
}

async function main(): Promise<void> {
  const database = createDatabase();
  try {
    const applied = await migrate(database);
    console.log(applied.length === 0 ? 'Database is up to date.' : `Applied: ${applied.join(', ')}`);
  } finally {
    await database.destroy();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
