import { pool, q } from '../db/index';
import { anticipate } from './anticipate';

// run the anticipation scan for every user (or --user <id>)
const flagIdx = process.argv.indexOf('--user');
const only = flagIdx >= 0 ? process.argv[flagIdx + 1] : null;

(async () => {
  const { rows } = only ? { rows: [{ id: only }] } : await q<{ id: string }>('SELECT id FROM users');
  for (const u of rows) await anticipate(u.id);
})()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
