import { pool } from '../db/index';
import { backfill } from './gmail';

backfill()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
