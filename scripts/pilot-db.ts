import { readFile } from 'node:fs/promises';
import { connectFixture, runIsolated } from '../ops/local/fixture.js';

export async function migrate(direction: string): Promise<void> {
  if (!['up', 'down'].includes(direction)) throw new Error('Expected up or down');
  if (direction === 'up') {
    try {
      if (!/^[a-f0-9]{64}$/.test(await readFile('work/pilot/throttle-key', 'utf8'))) throw new Error();
    } catch { throw new Error('Fixture throttle key is missing or invalid; preserve the old fixture and initialize a fresh one.'); }
  }
  const db = await connectFixture(true);
  try {
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(114, 1)");
    const target = (await db.query('SELECT current_database() AS db, current_user AS owner')).rows[0];
    if (target.db !== 'pilot_fixture' || target.owner !== 'pilot_owner') throw new Error('Non-fixture migration target');
    const unexpected = await db.query(`SELECT nspname FROM pg_namespace
      WHERE nspname NOT IN ('public','pilot','pg_catalog','information_schema') AND nspname NOT LIKE 'pg_toast%' AND nspname NOT LIKE 'pg_temp%'`);
    const publicObjects = await db.query("SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v','m','f','p') AND relname <> 'fixture_identity'");
    if (unexpected.rowCount || publicObjects.rowCount) throw new Error('Unexpected database objects; refusing migration');
    if (direction === 'down') {
      const tables = await db.query("SELECT quote_ident(tablename) AS name, tablename FROM pg_tables WHERE schemaname='pilot' ORDER BY tablename");
      if (!tables.rowCount) throw new Error('Pilot schema is not installed');
      await db.query(`LOCK TABLE ${tables.rows.map(r => `pilot.${r.name}`).join(',')} IN ACCESS EXCLUSIVE MODE`);
      for (const row of tables.rows) {
        const predicate = row.tablename === 'dispatch_control' ? 'WHERE NOT stopped' : '';
        if ((await db.query(`SELECT 1 FROM pilot.${row.name} ${predicate} LIMIT 1`)).rowCount) {
          throw new Error('Populated fixture; destructive migration refused');
        }
      }
    }
    const installed = (await db.query(`SELECT to_regclass('pilot.identities') AS base,
      to_regclass('pilot.oidc_attempts') AS oidc,
      to_regclass('pilot.auth_throttle_buckets') AS throttle,
      to_regclass('pilot.business_fact_revisions') AS facts,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='pilot' AND table_name='drafts' AND column_name='initial_location_id') AS draft_location,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='pilot' AND table_name='sessions' AND column_name='csrf_hash') AS access`)).rows[0];
    const migrations = direction === 'up'
      ? [...(installed.base ? [] : ['001_pilot']), ...(installed.access ? [] : ['002_customer_access']), ...(installed.oidc ? [] : ['003_oidc_attempts']), ...(installed.draft_location ? [] : ['004_draft_initial_location']), ...(installed.facts ? [] : ['005_business_facts']), ...(installed.throttle ? [] : ['006_auth_throttle'])]
      : [...(installed.throttle ? ['006_auth_throttle'] : []), ...(installed.facts ? ['005_business_facts'] : []), ...(installed.draft_location ? ['004_draft_initial_location'] : []), ...(installed.oidc ? ['003_oidc_attempts'] : []), ...(installed.access ? ['002_customer_access'] : []), '001_pilot'];
    if (!migrations.length) throw new Error('Pilot migrations already installed');
    for (const name of migrations) await db.query(await readFile(`db/migrations/${name}.${direction}.sql`, 'utf8'));
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { await db.end(); }
}

async function main(): Promise<void> {
  const direction = process.argv[2];
  if (!direction || !['up', 'down'].includes(direction) || process.argv.length !== 3) throw new Error('Usage: pilot:migrate -- up|down');
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['dist/pilot/scripts/pilot-db.js', direction]));
    return;
  }
  await migrate(direction);
  console.log(`Fixture migration ${direction} committed.`);
}
if (require.main === module) main().catch(error => {
  // SQL details may contain fixture data; report only a stable error code.
  console.error(`Fixture migration refused or failed (${(error as { code?: string }).code ?? 'guard'}).`);
  process.exitCode = 1;
});
