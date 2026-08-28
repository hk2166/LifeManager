import fs from 'node:fs';
import type express from 'express';
import multer from 'multer';
import { CLASSIFY_CONFIDENCE_MIN, UPLOADS_DIR } from './config';
import { q } from './db/index';
import { authed } from './auth';
import { transcribe } from './ai/transcribe';
import { classify, type Classification } from './ai/classify';

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const upload = multer({ dest: UPLOADS_DIR, limits: { fileSize: 25 * 1024 * 1024 } });

type Entities = Pick<Classification, 'title' | 'due_iso' | 'person' | 'direction'>;

async function createItem(userId: string, memoId: string, type: string, e: Entities, confidence: number | null, fallback = '') {
  const due = e.due_iso && !Number.isNaN(Date.parse(e.due_iso)) ? new Date(e.due_iso) : null;
  const direction = type === 'commitment' ? (e.direction ?? 'owed_by_me') : null;
  // on unintelligible audio the model can emit a placeholder title; fall back to the transcript
  const clean = (e.title ?? '').trim();
  const title = clean && !/^<.*>$|^unknown$/i.test(clean) ? clean : fallback.trim() || 'Voice memo';
  const { rows } = await q(
    `INSERT INTO items (user_id, type, direction, title, counterparty_name, due_at, confidence, source_kind, source_memo_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'memo',$8) RETURNING *`,
    [userId, type, direction, title, e.person, due, confidence, memoId]
  );
  await q('UPDATE memos SET item_id = $1 WHERE id = $2', [rows[0].id, memoId]);
  return rows[0];
}

export function registerMemoRoutes(app: express.Express) {
  // record-then-upload: audio lands here, then transcribe -> classify -> route (or chip)
  app.post('/api/memos', upload.single('audio'), authed(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'audio file missing' });
    const { rows: ins } = await q(
      `INSERT INTO memos (user_id, audio_path, status) VALUES ($1, $2, 'processing') RETURNING id`,
      [req.userId, req.file.path]
    );
    const id: string = ins[0].id;
    try {
      const { text, ms: transcribeMs } = await transcribe(req.file.path, req.file.originalname || 'memo.m4a');
      const t0 = Date.now();
      const c = await classify(text);
      const classifyMs = Date.now() - t0;
      const entities: Entities = { title: c.title, due_iso: c.due_iso, person: c.person, direction: c.direction };
      // below the confidence floor we ask, never guess silently
      const eligible = c.confidence >= CLASSIFY_CONFIDENCE_MIN;
      const item = eligible ? await createItem(req.userId, id, c.type, entities, c.confidence, text) : null;
      const { rows } = await q(
        `UPDATE memos SET transcript=$1, transcribe_ms=$2, classify_ms=$3, status=$4,
                          suggested_type=$5, confidence=$6, entities=$7
         WHERE id=$8 RETURNING *`,
        [
          text,
          transcribeMs,
          classifyMs,
          eligible ? 'routed' : 'pending_confirmation',
          c.type,
          c.confidence,
          JSON.stringify(entities),
          id,
        ]
      );
      res.json({ memo: rows[0], item, needs_confirmation: !eligible });
    } catch (e) {
      await q(`UPDATE memos SET status='failed' WHERE id=$1`, [id]).catch(() => {});
      throw e;
    }
  }));

  // one-tap chip: the human picked the type, file it
  app.post('/api/memos/:id/confirm', authed(async (req, res) => {
    const type = String(req.body?.type ?? '');
    const { rows } = await q('SELECT * FROM memos WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    const memo = rows[0];
    if (memo.item_id) return res.status(409).json({ error: 'memo already filed' });
    const entities: Entities = memo.entities ?? { title: memo.transcript?.slice(0, 60) ?? 'Memo', due_iso: null, person: null, direction: null };
    const item = await createItem(req.userId, memo.id, type, entities, memo.confidence, memo.transcript ?? '');
    const { rows: upd } = await q(`UPDATE memos SET status='routed' WHERE id=$1 RETURNING *`, [memo.id]);
    res.json({ memo: upd[0], item, needs_confirmation: false });
  }));

  app.get('/api/memos/:id', authed(async (req, res) => {
    const { rows } = await q('SELECT * FROM memos WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  }));

  // raw audio stays linked to the created item (T-28 AC)
  app.get('/api/memos/:id/audio', authed(async (req, res) => {
    const { rows } = await q('SELECT audio_path FROM memos WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!rows.length || !rows[0].audio_path) return res.status(404).json({ error: 'not found' });
    res.type('audio/mp4').sendFile(rows[0].audio_path);
  }));
}
