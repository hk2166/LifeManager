import { pool } from '../db/index';
import { backfill } from './gmail';
import { googleConnectedUserIds } from '../google';

// backfill Gmail for every Google-connected user (or --user <id>)
const flagIdx = process.argv.indexOf('--user');
const only = flagIdx >= 0 ? process.argv[flagIdx + 1] : null;

(async () => {
  const ids = only ? [only] : await googleConnectedUserIds();
  if (!ids.length) console.log('no Google-connected users to backfill');
  for (const uid of ids) await backfill(uid);
})()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
