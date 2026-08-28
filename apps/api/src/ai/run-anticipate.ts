import { pool } from '../db/index';
import { anticipate } from './anticipate';

anticipate()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
