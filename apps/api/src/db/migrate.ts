import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './index';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

export async function runMigrations() {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
  );
  const done = new Set((await pool.query('SELECT name FROM _migrations')).rows.map((r) => r.name));
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log(`applied ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
