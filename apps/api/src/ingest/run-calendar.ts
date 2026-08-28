import { pool } from '../db/index';
import { syncCalendar } from './calendar';

syncCalendar()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
