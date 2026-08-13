import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

export interface Database {
  schema_migrations: {
    filename: string;
    applied_at: Date;
  };
}

export function createDatabase(databaseUrl = process.env.DATABASE_URL): Kysely<Database> {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: databaseUrl }),
    }),
  });
}
