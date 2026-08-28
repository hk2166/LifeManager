import { searchMessages } from './embed';
import { structured, type ToolSpec } from './claude';
import { DEMO_OWNER_EMAIL, DEMO_OWNER_NAME } from '../config';

const TOOL: ToolSpec = {
  name: 'answer_question',
  description: 'Answer the question from the provided emails only.',
  input_schema: {
    type: 'object',
    properties: {
      answer: { type: 'string', description: 'Direct answer in 1-3 sentences. If unknown, say so plainly.' },
      source_message_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'ids of the messages the answer is grounded in (empty if unknown)',
      },
      confident: { type: 'boolean', description: 'false if the emails do not actually contain the answer' },
    },
    required: ['answer', 'source_message_ids', 'confident'],
  },
};

export async function askMemory(question: string, userId: string) {
  const hits = await searchMessages(question, userId, 8);
  if (!hits.length) {
    return { answer: 'No indexed email to search yet - run the embed step first.', confident: false, sources: [] };
  }
  const context = hits
    .map(
      (h) =>
        `[id=${h.id} from="${h.from_name ?? h.from_email}" sent=${new Date(h.sent_at).toISOString()} subject="${h.subject ?? ''}"]\n${h.body_text.slice(0, 1200)}`
    )
    .join('\n\n');
  const out = await structured<{ answer: string; source_message_ids: string[]; confident: boolean }>({
    system: `You answer questions for ${DEMO_OWNER_NAME} <${DEMO_OWNER_EMAIL}> strictly from the emails provided. If they do not contain the answer, say you don't know and set confident=false - NEVER invent details. Cite the id of every message you used.`,
    user: `Question: ${question}\n\nEmails:\n${context}`,
    tool: TOOL,
    maxTokens: 1024,
  });
  const byId = new Map(hits.map((h) => [h.id, h]));
  const sources = out.source_message_ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const h = byId.get(id)!;
      return {
        id,
        subject: h.subject,
        from_name: h.from_name,
        from_email: h.from_email,
        sent_at: h.sent_at,
        gmail_url: `https://mail.google.com/mail/u/0/#all/${id}`,
      };
    });
  return { answer: out.answer, confident: out.confident, sources };
}
