import { q } from '../db/index';
import { DEMO_OWNER_EMAIL, DEMO_OWNER_NAME } from '../config';
import { structured, type ToolSpec } from './claude';

const TOOL: ToolSpec = {
  name: 'write_brief',
  description: 'Write a pre-meeting brief.',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'One sentence: the single most important thing to remember' },
      bullets: { type: 'array', items: { type: 'string' }, description: '3-6 terse bullets, open loops first' },
    },
    required: ['headline', 'bullets'],
  },
};

export async function briefForEvent(eventId: string) {
  const { rows: evs } = await q('SELECT * FROM events WHERE id = $1', [eventId]);
  if (!evs.length) return null;
  const ev = evs[0];
  const attendees: { name: string; email: string }[] = ev.attendees ?? [];
  if (!attendees.length) {
    return { event: ev, headline: 'No attendees on this event - nothing to brief.', bullets: [], ms: 0 };
  }
  const emails = attendees.map((a) => a.email.toLowerCase());
  const { rows: msgs } = await q(
    `SELECT m.from_name, m.from_email, m.sent_at, m.body_text, t.subject
     FROM messages m JOIN threads t ON t.id = m.thread_id
     WHERE lower(m.from_email) = ANY($1) OR m.to_emails && $1
     ORDER BY m.sent_at DESC LIMIT 12`,
    [emails]
  );
  const { rows: open } = await q(
    `SELECT direction, title, due_at FROM items
     WHERE status = 'open' AND type = 'commitment' AND lower(counterparty_email) = ANY($1)`,
    [emails]
  );
  const t0 = Date.now();
  const openTxt = open.length
    ? open
        .map(
          (o) =>
            `- [${o.direction === 'owed_by_me' ? 'YOU owe them' : 'THEY owe you'}] ${o.title}${o.due_at ? ` (due ${new Date(o.due_at).toDateString()})` : ''}`
        )
        .join('\n')
    : '(none tracked)';
  const mailTxt = msgs
    .map(
      (m) =>
        `[${new Date(m.sent_at).toDateString()} from ${m.from_name ?? m.from_email}] ${m.subject ?? ''}: ${m.body_text.slice(0, 400)}`
    )
    .join('\n\n');
  const out = await structured<{ headline: string; bullets: string[] }>({
    system: `You write a 10-second pre-meeting brief for ${DEMO_OWNER_NAME} <${DEMO_OWNER_EMAIL}>. Lead with open loops - what each side owes the other - then the freshest context worth remembering. Terse and specific; no filler, no advice.`,
    user: `Meeting: "${ev.title}" at ${new Date(ev.start_at).toLocaleString()} with ${attendees.map((a) => a.name).join(', ')}

Tracked open commitments with these people:
${openTxt}

Recent email with them (newest first):
${mailTxt}`,
    tool: TOOL,
    maxTokens: 700,
  });
  return { event: ev, ...out, ms: Date.now() - t0 };
}
