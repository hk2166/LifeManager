import { q } from '../db/index';
import { structured, type ToolSpec } from './claude';

const TOOL: ToolSpec = {
  name: 'record_upcoming',
  description: 'Record upcoming obligations detectable from the inbox.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'e.g. "Auto insurance renews (rate rising to $131/mo)"' },
            date_iso: { type: 'string', description: 'ISO date it happens or is due' },
            source_message_id: { type: 'string' },
            confidence: { type: 'number' },
          },
          required: ['title', 'date_iso', 'source_message_id', 'confidence'],
        },
      },
    },
    required: ['items'],
  },
};

// One pass over the whole inbox in a single call: renewals, bills, appointments,
// deadlines - the mental-load stuff nobody tracks. Surfaces them BEFORE they're urgent.
export async function anticipate(userId: string) {
  const { rows: msgs } = await q<{ id: string; subject: string | null; snippet: string | null; sent_at: Date }>(
    `SELECT m.id, t.subject, m.snippet, m.sent_at FROM messages m JOIN threads t ON t.id = m.thread_id
     WHERE m.user_id = $1 ORDER BY m.sent_at DESC LIMIT 200`,
    [userId]
  );
  if (!msgs.length) return 0;
  const listing = msgs
    .map((m) => `[id=${m.id} sent=${new Date(m.sent_at).toDateString()}] ${m.subject ?? ''} :: ${m.snippet ?? ''}`)
    .join('\n');
  const out = await structured<{ items: { title: string; date_iso: string; source_message_id: string; confidence: number }[] }>({
    system: `From the email listing, find FUTURE-dated obligations the owner would otherwise forget: renewals, bills, appointments, expiring deadlines, birthdays. Only concrete dated things from automated or informational mail - NOT tasks or promises between people, NOT marketing urgency ("sale ends Friday"). Today is ${new Date().toDateString()}.`,
    user: listing,
    tool: TOOL,
    maxTokens: 1024,
  });
  // rerun-safe: this pass owns this user's email-sourced reminders, so replace them wholesale
  await q(`DELETE FROM items WHERE user_id = $1 AND source_kind = 'email' AND type = 'reminder'`, [userId]);
  const ids = new Set(msgs.map((m) => m.id));
  let n = 0;
  for (const it of Array.isArray(out.items) ? out.items : []) {
    if (it.confidence < 0.6 || !ids.has(it.source_message_id)) continue;
    const due = Number.isNaN(Date.parse(it.date_iso)) ? null : new Date(it.date_iso);
    if (!due || due.getTime() < Date.now()) continue;
    await q(
      `INSERT INTO items (user_id, type, title, due_at, confidence, source_kind, source_message_id)
       VALUES ($5, 'reminder', $1, $2, $3, 'email', $4)`,
      [it.title, due, it.confidence, it.source_message_id, userId]
    );
    n++;
  }
  console.log(`anticipate: ${n} upcoming item(s)`);
  return n;
}
