import { q } from '../db/index';
import { DEMO_OWNER_NAME } from '../config';
import { structured, type ToolSpec } from './claude';

const TOOL: ToolSpec = {
  name: 'draft_nudge',
  description: 'Draft a follow-up email. It will never be sent automatically.',
  input_schema: {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      body: { type: 'string', description: '3-5 sentences, friendly, references what was promised and when' },
    },
    required: ['subject', 'body'],
  },
};

export async function draftNudge(itemId: string) {
  const { rows } = await q(
    `SELECT i.*, m.body_text AS src_body, m.sent_at AS src_sent_at, t.subject AS src_subject
     FROM items i
     LEFT JOIN messages m ON m.id = i.source_message_id
     LEFT JOIN threads t ON t.id = m.thread_id
     WHERE i.id = $1`,
    [itemId]
  );
  if (!rows.length) return null;
  const i = rows[0];
  const out = await structured<{ subject: string; body: string }>({
    system: `Draft a short, friendly follow-up email from ${DEMO_OWNER_NAME} nudging someone about something they promised. Reference the specific promise and roughly how long it's been. Warm, zero guilt-tripping, one clear ask. Output the email only.`,
    user: `Waiting on: ${i.title}
Counterparty: ${i.counterparty_name ?? i.counterparty_email ?? 'unknown'}
Promised${i.src_sent_at ? ` on ${new Date(i.src_sent_at).toDateString()}` : ''}${i.due_at ? `, due ${new Date(i.due_at).toDateString()}` : ''}. Today is ${new Date().toDateString()}.
${i.src_subject ? `Original thread subject: ${i.src_subject}` : ''}
${i.src_body ? `Original message:\n${String(i.src_body).slice(0, 600)}` : ''}`,
    tool: TOOL,
    maxTokens: 500,
  });
  return out;
}
