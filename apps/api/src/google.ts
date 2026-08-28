import { google } from 'googleapis';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from './config';
import { q } from './db/index';

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

export function oauthClient() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

// merge (||) so a refresh response without refresh_token never clobbers the stored one
export async function saveTokens(tokens: object) {
  await q(
    `INSERT INTO google_tokens (id, tokens, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET tokens = google_tokens.tokens || EXCLUDED.tokens, updated_at = now()`,
    [JSON.stringify(tokens)]
  );
}

export async function getAuthed() {
  const { rows } = await q('SELECT tokens FROM google_tokens WHERE id = 1');
  if (!rows.length) throw new Error('Google account not connected - open /auth/google first');
  const client = oauthClient();
  client.setCredentials(rows[0].tokens);
  client.on('tokens', (t) => void saveTokens(t).catch((e) => console.error('token save failed', e)));
  return client;
}
