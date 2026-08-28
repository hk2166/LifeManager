import { pool } from './index';
import { runMigrations } from './migrate';
import { runSeed } from '../../seed/seed';
import { hashPassword } from '../auth';
import { DEMO_OWNER_EMAIL, DEMO_OWNER_NAME } from '../config';

async function main() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await runMigrations();
  // a demo account so the reset DB has something to log into and see
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id`,
    [DEMO_OWNER_EMAIL, await hashPassword('demodemo'), DEMO_OWNER_NAME]
  );
  await runSeed(rows[0].id);
  console.log(`reset complete — demo login: ${DEMO_OWNER_EMAIL} / demodemo`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
