import pg from 'pg';
import { DATABASE_URL } from '../config';

export const pool = new pg.Pool({ connectionString: DATABASE_URL });

export const q = <T extends pg.QueryResultRow = any>(text: string, params?: unknown[]) =>
  pool.query<T>(text, params as any[]);
