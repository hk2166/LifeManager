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
export async function saveTokens(userId: string, tokens: object) {
  await q(
    `INSERT INTO google_tokens (user_id, tokens, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET tokens = google_tokens.tokens || EXCLUDED.tokens, updated_at = now()`,
    [userId, JSON.stringify(tokens)]
  );
}

export async function getAuthed(userId: string) {
  const { rows } = await q('SELECT tokens FROM google_tokens WHERE user_id = $1', [userId]);
  if (!rows.length) throw new Error('Google account not connected - open /auth/google first');
  const client = oauthClient();
  client.setCredentials(rows[0].tokens);
  client.on('tokens', (t) => void saveTokens(userId, t).catch((e) => console.error('token save failed', e)));
  return client;
}

// users who have connected Google — the tick iterates these
export async function googleConnectedUserIds(): Promise<string[]> {
  const { rows } = await q<{ user_id: string }>('SELECT user_id FROM google_tokens');
  return rows.map((r) => r.user_id);
}
