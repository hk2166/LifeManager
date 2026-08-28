import { structured, type ToolSpec } from './claude';

// A voice memo is either a QUESTION the speaker wants answered right now, or
// something to CAPTURE (note/task/reminder/commitment/event/shopping) for later.
export type MemoIntent = 'ask' | 'capture';

const TOOL: ToolSpec = {
  name: 'route_memo',
  description: 'Decide whether a spoken voice memo is a question to answer now, or an item to file for later.',
  input_schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['ask', 'capture'],
        description:
          "ask = the speaker is asking for information they expect back right now (\"what am I waiting on from Dana?\", \"what's due today?\", \"when's my dentist appointment?\", \"how many commitments do I owe?\"). capture = the speaker is recording something to file for later (\"remind me to call the bank\", \"I told Priya I'd send the deck\", \"buy batteries\", \"dentist Tuesday at 3\").",
      },
    },
    required: ['intent'],
  },
};

// Kept separate from classify() so the tuned memo-classification eval stays untouched.
export async function detectIntent(transcript: string): Promise<MemoIntent> {
  const t = transcript.trim();
  if (!t) return 'capture';
  const out = await structured<{ intent: MemoIntent }>({
    system: `You route one short voice memo. Decide if it is a QUESTION the speaker wants answered now (ask) or something to file as an item (capture). Imperatives that create a to-do ("remind me to...", "add...", "I need to...") are capture even though they sound like commands. When genuinely torn, prefer capture — a wrongly-answered note is worse than a filed question.`,
    user: t,
    tool: TOOL,
    maxTokens: 64,
  });
  return out.intent === 'ask' ? 'ask' : 'capture';
}
