import { pool } from './index';
import { runMigrations } from './migrate';
import { runSeed } from '../../seed/seed';

async function main() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations();
  await runSeed();
  await pool.end();
  console.log('reset complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
