import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { createDatabase, type Database } from '../../src/database/db.js';
import { migrate } from '../../src/database/migrate.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase('initial database migration', () => {
  let database!: Database;

  beforeAll(async () => {
    database = createDatabase(databaseUrl);
    await migrate(database);
  });

  afterAll(async () => {
    await database.destroy();
  });

  it('creates PostGIS and critical invariant tables', async () => {
    const extensions = await sql<{ extname: string }>`select extname from pg_extension where extname = 'postgis'`.execute(database);
    expect(extensions.rows).toHaveLength(1);
    const tables = await sql<{ tablename: string }>`select tablename from pg_tables where schemaname = 'public'`.execute(database);
    expect(tables.rows.map((row) => row.tablename)).toEqual(expect.arrayContaining(['claims', 'factor_catalog', 'mock_demo_factor_approvals', 'demo_factor_manifest', 'calculation_snapshots', 'carbon_ledger', 'point_ledger', 'vouchers']));
  });

  it('installs immutable-ledger protections and records no migration twice', async () => {
    const triggers = await sql<{ tgname: string }>`select tgname from pg_trigger where tgname in ('calculation_snapshots_immutable', 'carbon_ledger_immutable', 'point_ledger_immutable')`.execute(database);
    expect(triggers.rows.map((row) => row.tgname)).toHaveLength(3);
    expect(await migrate(database)).toEqual([]);
  });

  it('uses half-even SQL parity and can rebuild a materialized point balance from the immutable ledger', async () => {
    const rounded = await sql<{ down: string; up: string }>`
      select round_half_even(0.1000005::numeric,6)::numeric(20,6)::text down,
             round_half_even(0.1000015::numeric,6)::numeric(20,6)::text up
    `.execute(database);
    expect(rounded.rows[0]).toEqual({ down: '0.100000', up: '0.100002' });

    await sql`
      insert into users(id,email,display_name,role,is_demo)
      values('22222222-2222-4222-8222-222222222222','balance-rebuild@example.test','ทดสอบยอดคงเหลือ','reviewer',true)
      on conflict(id) do nothing
    `.execute(database);
    await sql`
      insert into point_balances(user_id,balance)
      values('22222222-2222-4222-8222-222222222222',999)
      on conflict(user_id) do update set balance=excluded.balance
    `.execute(database);
    const rebuilt = await sql<{ balance: number }>`
      select rebuild_point_balance('22222222-2222-4222-8222-222222222222') balance
    `.execute(database);
    expect(rebuilt.rows[0]?.balance).toBe(0);
  });
});

if (!databaseUrl) {
  describe('initial database migration configuration', () => {
    it.skip('requires TEST_DATABASE_URL: PostgreSQL 17 with PostGIS is required for migration integration tests.', () => undefined);
  });
}
