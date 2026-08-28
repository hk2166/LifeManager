import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, PORT, REPO_ROOT } from './config';
import { q } from './db/index';
import { googleConnectedUserIds, oauthClient, saveTokens, SCOPES } from './google';
import { h } from './http';
import { authed, hashPassword, requireAuth, signToken, verifyPassword, verifyToken } from './auth';
import { runSeed } from '../seed/seed';
import { registerMemoRoutes } from './memos';
import { syncRecent } from './ingest/gmail';
import { syncCalendar } from './ingest/calendar';
import { extractAll } from './ai/extract';
import { embedMissing } from './ai/embed';
import { askMemory } from './ai/ask';
import { briefForEvent } from './ai/brief';
import { generateDigest } from './ai/digest';
import { draftNudge } from './ai/nudge';
import { synthesizeSpeech } from './ai/tts';

export const gmailUrl = (messageId: string) => `https://mail.google.com/mail/u/0/#all/${messageId}`;

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

// ---- auth ----
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

app.post('/api/auth/register', h(async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const name = String(req.body?.name ?? '').trim() || email.split('@')[0];
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'enter a valid email' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
  const exists = await q('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rows.length) return res.status(409).json({ error: 'an account with that email already exists' });
  const { rows } = await q(
    'INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email, name',
    [email, await hashPassword(password), name]
  );
  const user = rows[0];
  await runSeed(user.id); // give every new account the demo corpus to explore
  res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, name: user.name } });
}));

app.post('/api/auth/login', h(async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const { rows } = await q('SELECT id, email, name, password_hash FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'wrong email or password' });
  }
  res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, name: user.name } });
}));

app.get('/api/me', requireAuth, authed(async (req, res) => {
  const { rows } = await q('SELECT id, email, name FROM users WHERE id = $1', [req.userId]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
}));

// every /api route below requires a valid token
app.use('/api', requireAuth);

// ---- Google OAuth (per user, via the token in the state param) ----
app.get('/auth/google', (req, res) => {
  const state = String(req.query.token ?? '');
  if (!state) return res.status(401).send('missing token');
  const url = oauthClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES, state });
  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  try {
    const code = String(req.query.code ?? '');
    const token = String(req.query.state ?? '');
    if (!code || !token) return res.status(400).send('missing code or state');
    const userId = verifyToken(token);
    const { tokens } = await oauthClient().getToken(code);
    await saveTokens(userId, tokens);
    res.send('Google account connected. You can close this tab.');
  } catch (e) {
    console.error(e);
    res.status(500).send('OAuth exchange failed - check server logs');
  }
});

// ---- read API (scoped to the authed user) ----
app.get('/api/items', authed(async (req, res) => {
  const { rows } = await q(
    `SELECT i.*, t.subject AS src_subject, m.from_name AS src_from_name,
            m.from_email AS src_from_email, m.sent_at AS src_sent_at
     FROM items i
     LEFT JOIN messages m ON m.id = i.source_message_id
     LEFT JOIN threads t ON t.id = m.thread_id
     WHERE i.user_id = $1
     ORDER BY i.created_at DESC`,
    [req.userId]
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

app.get('/api/messages/:id', authed(async (req, res) => {
  const { rows } = await q(
    `SELECT m.*, t.subject FROM messages m LEFT JOIN threads t ON t.id = m.thread_id
     WHERE m.id = $1 AND m.user_id = $2`,
    [req.params.id, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ ...rows[0], gmail_url: gmailUrl(rows[0].id) });
}));

app.get('/api/events', authed(async (req, res) => {
  const { rows } = await q(
    `SELECT * FROM events WHERE user_id = $1 AND start_at >= now() - interval '1 hour' ORDER BY start_at LIMIT 20`,
    [req.userId]
  );
  res.json(rows);
}));

app.get('/api/events/:id/brief', authed(async (req, res) => {
  const brief = await briefForEvent(req.params.id, req.userId);
  if (!brief) return res.status(404).json({ error: 'event not found' });
  res.json(brief);
}));

app.post('/api/ask', authed(async (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: 'question missing' });
  res.json(await askMemory(question, req.userId));
}));

app.get('/api/digest', authed(async (req, res) => res.json(await generateDigest(req.userId))));

app.post('/api/items/:id/nudge', authed(async (req, res) => {
  const draft = await draftNudge(req.params.id, req.userId);
  if (!draft) return res.status(404).json({ error: 'item not found' });
  res.json(draft);
}));

// Text-to-speech so the app can talk back (voice-command answers, confirmations).
app.post('/api/tts', authed(async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'text missing' });
  const audio = await synthesizeSpeech(text);
  res.type('audio/mpeg').send(audio);
}));

registerMemoRoutes(app);

// T-08: background tick - new mail + calendar every 2 min, then incremental
// extraction/embedding. Silently idle until Google is connected / keys exist.
let ticking = false;
setInterval(async () => {
  if (ticking) return;
  ticking = true;
  try {
    for (const uid of await googleConnectedUserIds()) {
      await syncRecent(uid).catch((e) => console.error('[sync]', String(e)));
      await syncCalendar(uid).catch((e) => console.error('[cal]', String(e)));
    }
    // extraction/embedding are global but carry each row's user_id from its thread
    if (ANTHROPIC_API_KEY) await extractAll();
    if (OPENAI_API_KEY) await embedMissing();
  } catch (e) {
    console.error('[tick]', String(e));
  } finally {
    ticking = false;
  }
}, 2 * 60_000);

// In production the API also serves the built dashboard (single-service deploy).
// No-op locally where apps/web/dist doesn't exist and Vite serves the web itself.
const webDist = path.join(REPO_ROOT, 'apps/web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.listen(PORT, () => console.log(`api listening on ${PORT}`));
