import { pool } from '../db/index';
import { extractAll } from './extract';

extractAll(process.argv.includes('--force'))
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
