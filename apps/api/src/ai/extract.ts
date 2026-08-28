import { q } from '../db/index';
import { DEMO_OWNER_EMAIL, DEMO_OWNER_NAME } from '../config';
import { structured, type ToolSpec } from './claude';
import { isAutomatedSender } from './senders';

export interface ExtractedCommitment {
  title: string;
  direction: 'owed_by_me' | 'owed_to_me';
  counterparty_name: string | null;
  counterparty_email: string;
  due_iso: string | null;
  source_message_id: string;
  confidence: number;
}

const TOOL: ToolSpec = {
  name: 'record_commitments',
  description: 'Record every real commitment found in the email thread.',
  input_schema: {
    type: 'object',
    properties: {
      commitments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short imperative summary, e.g. "Send revised deck to Priya"' },
            direction: { type: 'string', enum: ['owed_by_me', 'owed_to_me'] },
            counterparty_name: { type: ['string', 'null'] },
            counterparty_email: { type: 'string' },
            due_iso: {
              type: ['string', 'null'],
              description: 'ISO 8601 date the promise is due, null if no timeframe stated',
            },
            source_message_id: { type: 'string', description: 'id of the message containing the promise' },
            confidence: { type: 'number', description: '0-1: how sure this is a real commitment' },
          },
          required: ['title', 'direction', 'counterparty_email', 'source_message_id', 'confidence'],
        },
      },
    },
    required: ['commitments'],
  },
};

const system = () => `You extract commitments from email threads. The inbox owner is ${DEMO_OWNER_NAME} <${DEMO_OWNER_EMAIL}> ("me").

A commitment is a CONCRETE promise by a specific person to do a specific thing, stated in the thread.
- direction owed_by_me: the owner promised someone else something.
- direction owed_to_me: someone else promised the owner something.

Rules:
- Only explicit promises ("I will send X by Friday"). NOT vague intent ("I'll take a look sometime", "we should catch up"), NOT marketing or newsletter imperatives ("renew now!"), NOT automated reminders or receipts, NOT requests nobody accepted.
- The counterparty is the OTHER party: the promisee for owed_by_me, the promiser for owed_to_me.
- due_iso: resolve relative dates ("Thursday", "tomorrow", "end of week") against the sent timestamp of the message containing the promise; end of week means that week's Friday. Null if no timeframe is stated.
- confidence in [0,1]. Below 0.5 means you probably should not have extracted it.
- No commitments in the thread: return an empty array.
Current timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`;

interface DbMessage {
  id: string;
  from_name: string | null;
  from_email: string;
  sent_at: Date;
  body_text: string;
}

export function formatThread(subject: string | null, messages: DbMessage[]): string {
  const parts = [`Subject: ${subject ?? '(none)'}`];
  for (const m of messages) {
    const from = m.from_name ? `${m.from_name} <${m.from_email}>` : m.from_email;
    parts.push(`[message id=${m.id} from="${from}" sent=${m.sent_at.toISOString()}]\n${m.body_text}`);
  }
  return parts.join('\n\n');
}

// Pure extraction for one thread - the eval (T-12) calls this directly.
export async function extractThread(threadId: string): Promise<ExtractedCommitment[]> {
  const { rows: messages } = await q<DbMessage>(
    'SELECT id, from_name, from_email, sent_at, body_text FROM messages WHERE thread_id = $1 ORDER BY sent_at',
    [threadId]
  );
  if (!messages.length) return [];
  const { rows: t } = await q('SELECT subject FROM threads WHERE id = $1', [threadId]);
  const out = await structured<{ commitments: ExtractedCommitment[] }>({
    system: system(),
    user: formatThread(t[0]?.subject ?? null, messages),
    tool: TOOL,
  });
  const ids = new Set(messages.map((m) => m.id));
  // the model may omit the array entirely on a no-commitment thread
  const commitments = Array.isArray(out.commitments) ? out.commitments : [];
  return commitments.map((c) => ({
    ...c,
    // if the model hallucinated a message id, anchor to the thread's last message
    source_message_id: ids.has(c.source_message_id) ? c.source_message_id : messages[messages.length - 1].id,
  }));
}

async function persist(threadId: string, commitments: ExtractedCommitment[], lastMessageId: string) {
  // re-extraction of a changed thread replaces its commitments instead of duplicating them
  await q(
    `DELETE FROM items WHERE source_kind = 'email' AND type = 'commitment'
       AND source_message_id IN (SELECT id FROM messages WHERE thread_id = $1)`,
    [threadId]
  );
  for (const c of commitments) {
    if (c.confidence < 0.5) continue;
    const due = c.due_iso && !Number.isNaN(Date.parse(c.due_iso)) ? new Date(c.due_iso) : null;
    await q(
      `INSERT INTO items (type, direction, title, counterparty_name, counterparty_email, due_at, confidence, source_kind, source_message_id)
       VALUES ('commitment', $1, $2, $3, $4, $5, $6, 'email', $7)`,
      [c.direction, c.title, c.counterparty_name, c.counterparty_email.toLowerCase(), due, c.confidence, c.source_message_id]
    );
  }
  await q(
    `INSERT INTO extraction_state (thread_id, last_message_id) VALUES ($1, $2)
     ON CONFLICT (thread_id) DO UPDATE SET last_message_id = EXCLUDED.last_message_id, extracted_at = now()`,
    [threadId, lastMessageId]
  );
}

// Idempotent: threads already in extraction_state are skipped unless force.
export async function extractAll(force = false) {
  if (force) {
    await q(`DELETE FROM items WHERE source_kind = 'email'`);
    await q('DELETE FROM extraction_state');
  }
  // new threads, plus threads whose latest message changed since last extraction
  const { rows: threads } = await q<{ id: string; last_id: string }>(
    `SELECT t.id, last.id AS last_id
     FROM threads t
     JOIN LATERAL (SELECT m.id FROM messages m WHERE m.thread_id = t.id ORDER BY m.sent_at DESC LIMIT 1) last ON true
     LEFT JOIN extraction_state es ON es.thread_id = t.id
     WHERE es.thread_id IS NULL OR es.last_message_id <> last.id`
  );
  // Pre-filter: a thread can only hold a commitment involving the owner if the
  // owner participated or a real human wrote. All-automated threads are skipped
  // (and marked done so they aren't rescanned) - no LLM call spent on no-reply mail.
  const owner = DEMO_OWNER_EMAIL.toLowerCase();
  let found = 0;
  let skipped = 0;
  for (const t of threads) {
    const { rows: senders } = await q<{ from_email: string }>(
      'SELECT DISTINCT lower(from_email) AS from_email FROM messages WHERE thread_id = $1',
      [t.id]
    );
    const worthReading = senders.some((s) => s.from_email === owner || !isAutomatedSender(s.from_email));
    if (!worthReading) {
      await persist(t.id, [], t.last_id);
      skipped++;
      continue;
    }
    const commitments = await extractThread(t.id);
    await persist(t.id, commitments, t.last_id);
    found += commitments.filter((c) => c.confidence >= 0.5).length;
    console.log(`${t.id}: ${commitments.length} commitment(s)`);
  }
  console.log(`extracted ${found} item(s) from ${threads.length - skipped} thread(s); skipped ${skipped} automated`);
}
