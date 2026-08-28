import { q } from '../db/index';
import { DEMO_OWNER_NAME } from '../config';
import { structured, type ToolSpec } from './claude';

const TOOL: ToolSpec = {
  name: 'write_digest',
  description: 'Write the end-of-day digest.',
  input_schema: {
    type: 'object',
    properties: {
      digest: { type: 'string', description: '2-4 sentences of plain prose: what happened, what is owed, what is next' },
    },
    required: ['digest'],
  },
};

export async function generateDigest() {
  const { rows: newToday } = await q(
    `SELECT type, direction, title FROM items WHERE created_at >= date_trunc('day', now()) ORDER BY created_at`
  );
  const { rows: open } = await q(
    `SELECT direction, title, due_at FROM items
     WHERE status = 'open' AND type = 'commitment' ORDER BY due_at NULLS LAST LIMIT 12`
  );
  const { rows: upcoming } = await q(
    `SELECT title, start_at FROM events WHERE start_at BETWEEN now() AND now() + interval '36 hours' ORDER BY start_at LIMIT 5`
  );
  const t0 = Date.now();
  const out = await structured<{ digest: string }>({
    system: `You write ${DEMO_OWNER_NAME}'s end-of-day digest: short, factual prose. Mention what got captured today, the most pressing things owed in each direction, and what's on the calendar next. No bullet points, no headers, no cheerleading.`,
    user: `Captured today:
${newToday.map((i) => `- ${i.type}${i.direction ? `/${i.direction}` : ''}: ${i.title}`).join('\n') || '(nothing)'}

Open commitments:
${open.map((i) => `- [${i.direction}] ${i.title}${i.due_at ? ` due ${new Date(i.due_at).toDateString()}` : ''}`).join('\n') || '(none)'}

Next 36h on the calendar:
${upcoming.map((e) => `- ${e.title} at ${new Date(e.start_at).toLocaleString()}`).join('\n') || '(nothing)'}`,
    tool: TOOL,
    maxTokens: 500,
  });
  return { digest: out.digest, ms: Date.now() - t0 };
}
