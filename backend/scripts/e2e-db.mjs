// Prepares the database the end-to-end tests run against, so they never touch the
// working (demo) database. Idempotent: creates it if missing, applies migrations, seeds
// the administrator. Then start the test API with the printed variables:
//
//   npm run e2e:db
//   DATABASE_URL=<printed> MEDIA_DIR=uploads-e2e PORT=3001 node dist/main.js
//
// The test database name is the working one plus "_e2e" (override with E2E_DATABASE_URL).

import { execSync } from 'node:child_process';
import pg from 'pg';

const base = process.env.DATABASE_URL;
if (!base) throw new Error('DATABASE_URL must be set');

const url = new URL(process.env.E2E_DATABASE_URL ?? base);
if (!process.env.E2E_DATABASE_URL) url.pathname = `${url.pathname}_e2e`;
const name = decodeURIComponent(url.pathname.slice(1));
if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Unexpected database name: ${name}`);

// Connect to the server's maintenance database to create the test one.
const admin = new URL(base);
admin.pathname = '/postgres';
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
if (!rowCount) {
  await client.query(`CREATE DATABASE "${name}"`);
  console.log(`Created database ${name}`);
}
await client.end();

const env = { ...process.env, DATABASE_URL: url.toString() };
execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
execSync('npx prisma db seed', { stdio: 'inherit', env });
console.log(`\nE2E database ready: ${url.toString().replace(/:[^:@/]+@/, ':***@')}`);
