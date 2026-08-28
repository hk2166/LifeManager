import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
dotenv.config({ path: path.join(REPO_ROOT, '.env') });

// API_PORT wins locally (dev launchers inject PORT for the frontend); PORT is what
// hosting platforms (Render/Fly/etc.) inject in production; 3001 is the local default.
export const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/lifeos';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
export const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/oauth2callback';

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

export const DEMO_OWNER_NAME = process.env.DEMO_OWNER_NAME ?? 'Hemant';
export const DEMO_OWNER_EMAIL = process.env.DEMO_OWNER_EMAIL ?? 'you@lifeos.demo';

export const CLASSIFY_CONFIDENCE_MIN = Number(process.env.CLASSIFY_CONFIDENCE_MIN ?? 0.8);
export const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-in-prod';
export const UPLOADS_DIR = path.join(REPO_ROOT, 'uploads');
