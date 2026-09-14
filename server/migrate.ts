import { readdir, readFile } from 'node:fs/promises';
import { pool, transaction } from './db';
const directory = new URL('./migrations/', import.meta.url);
export async function migrate() {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(472103)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())',
    );
    for (const file of files) {
      const version = file.slice(0, file.indexOf('_'));
      if (
        (await client.query('SELECT 1 FROM schema_migrations WHERE version=$1', [version])).rowCount
      )
        continue;
      await client.query(await readFile(new URL(file, directory), 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
    }
  });
}
if (process.argv[1]?.endsWith('migrate.ts')) {
  migrate()
    .then(() => console.log('Database migration complete.'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
