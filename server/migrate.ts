import { readFile } from 'node:fs/promises';
import { pool, transaction } from './db';
export async function migrate() {
  const sql = await readFile(new URL('./migrations/001_initial.sql', import.meta.url), 'utf8');
  await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(472103)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
    if (!(await client.query("SELECT 1 FROM schema_migrations WHERE version='001'")).rowCount) {
      await client.query(sql); await client.query("INSERT INTO schema_migrations(version) VALUES ('001')");
    }
  });
}
if (process.argv[1]?.endsWith('migrate.ts')) {
  migrate().then(() => console.log('Database migration complete.')).catch(e => { console.error(e); process.exitCode=1; }).finally(() => pool.end());
}
