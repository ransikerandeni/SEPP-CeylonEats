import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

/**
 * Prepares an isolated PostgreSQL schema for the browser tests.
 *
 * The end-to-end run writes real reviews, so it must not touch the schema the
 * developer is browsing. This drops and recreates a dedicated schema, then
 * points migrate/seed at it through the connection's search_path - the same
 * trick tests/integration.test.ts uses for its own throwaway schema.
 */
const SCHEMA = process.env.E2E_SCHEMA || 'e2e';
const PASSWORD = process.env.E2E_PASSWORD || 'Playwright-e2e-password-9137';

if (!/^[a-z][a-z0-9_]*$/.test(SCHEMA)) throw new Error('Use a simple lowercase schema name.');

const base = process.env.DATABASE_URL;
if (!base) throw new Error('Set DATABASE_URL before preparing the end-to-end database.');

// Reset the schema over a connection that does not select it.
const adminUrl = new URL(base);
adminUrl.searchParams.delete('options');
// A single session, so the lock timeout below applies to the drop that follows.
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();

/**
 * A server left running by an earlier test run still holds open connections to
 * this schema, and DROP SCHEMA waits on their locks indefinitely - which looks
 * like Playwright hanging on "Timed out waiting from config.webServer".
 * Close those sessions first, then take a lock timeout so a genuinely stuck
 * drop fails loudly instead of stalling the whole suite.
 */
await admin.query(
  `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE datname = current_database() AND pid <> pg_backend_pid()`,
);
await admin.query("SET lock_timeout = '15s'");
await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
await admin.query(`CREATE SCHEMA ${SCHEMA}`);
await admin.end();

const scoped = new URL(adminUrl);
scoped.searchParams.set('options', `-c search_path=${SCHEMA}`);

// seed() runs the migrations itself before inserting the sample catalog.
const result = spawnSync('npx', ['tsx', 'server/seed.ts'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: scoped.toString(), SEED_PASSWORD: PASSWORD },
});
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`End-to-end schema "${SCHEMA}" is ready.`);
