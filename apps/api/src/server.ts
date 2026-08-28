import express from 'express';
import cors from 'cors';
import { ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, PORT } from './config';
import { q } from './db/index';
import { oauthClient, saveTokens, SCOPES } from './google';

export const gmailUrl = (messageId: string) => `https://mail.google.com/mail/u/0/#all/${messageId}`;

// express 4 doesn't catch async route errors - without this a DB hiccup kills the process
const h =
  (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response) =>
    void fn(req, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) res.status(500).json({ error: String(e?.message ?? e) });
    });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  let db = false;
  try {
    await q('SELECT 1');
    db = true;
  } catch {}
  const keys = {
    anthropic: Boolean(ANTHROPIC_API_KEY),
    openai: Boolean(OPENAI_API_KEY),
    google: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
  };
  // ?deep=1 actually round-trips the LLM/transcription APIs (needs keys)
  let deep: Record<string, boolean> | undefined;
  if (req.query.deep) {
    deep = {};
    if (ANTHROPIC_API_KEY) {
      deep.anthropic = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      }).then((r) => r.ok, () => false);
    }
    if (OPENAI_API_KEY) {
      deep.openai = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      }).then((r) => r.ok, () => false);
    }
  }
  res.json({ ok: true, db, keys, ...(deep ? { deep } : {}) });
});

// ---- Google OAuth (T-06) ----
app.get('/auth/google', (_req, res) => {
  const url = oauthClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  try {
    const code = String(req.query.code ?? '');
    if (!code) return res.status(400).send('missing code');
    const { tokens } = await oauthClient().getToken(code);
    await saveTokens(tokens);
    res.send('Google account connected. You can close this tab.');
  } catch (e) {
    console.error(e);
    res.status(500).send('OAuth exchange failed - check server logs');
  }
});

// ---- read API (T-10) ----
app.get('/api/items', h(async (_req, res) => {
  const { rows } = await q(
    `SELECT i.*, t.subject AS src_subject, m.from_name AS src_from_name,
            m.from_email AS src_from_email, m.sent_at AS src_sent_at
     FROM items i
     LEFT JOIN messages m ON m.id = i.source_message_id
     LEFT JOIN threads t ON t.id = m.thread_id
     ORDER BY i.created_at DESC`
  );
  res.json(
    rows.map(({ src_subject, src_from_name, src_from_email, src_sent_at, ...item }) => ({
      ...item,
      source: item.source_message_id
        ? {
            id: item.source_message_id,
            subject: src_subject,
            from_name: src_from_name,
            from_email: src_from_email,
            sent_at: src_sent_at,
            gmail_url: gmailUrl(item.source_message_id),
          }
        : null,
    }))
  );
}));

app.get('/api/messages/:id', h(async (req, res) => {
  const { rows } = await q(
    `SELECT m.*, t.subject FROM messages m LEFT JOIN threads t ON t.id = m.thread_id WHERE m.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ ...rows[0], gmail_url: gmailUrl(rows[0].id) });
}));

app.listen(PORT, () => console.log(`api on http://localhost:${PORT}`));
