import { pool } from '../db/index';
import { embedMissing } from './embed';

embedMissing()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
