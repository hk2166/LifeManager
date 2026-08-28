import { pool } from '../db/index';
import { syncCalendar } from './calendar';
import { googleConnectedUserIds } from '../google';

const flagIdx = process.argv.indexOf('--user');
const only = flagIdx >= 0 ? process.argv[flagIdx + 1] : null;

(async () => {
  const ids = only ? [only] : await googleConnectedUserIds();
  if (!ids.length) console.log('no Google-connected users');
  for (const uid of ids) await syncCalendar(uid);
})()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
