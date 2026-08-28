import type { ItemType } from 'shared';
import { structured, type ToolSpec } from './claude';

export interface Classification {
  type: ItemType;
  title: string;
  due_iso: string | null;
  person: string | null;
  direction: 'owed_by_me' | 'owed_to_me' | null;
  confidence: number;
}

const TOOL: ToolSpec = {
  name: 'classify_memo',
  description: 'Classify a voice memo transcript and extract its entities.',
  input_schema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['commitment', 'task', 'reminder', 'note', 'event', 'shopping'] },
      title: { type: 'string', description: 'Short actionable title for the created item' },
      due_iso: { type: ['string', 'null'], description: 'ISO 8601 datetime if a date/time is stated or implied, else null' },
      person: { type: ['string', 'null'], description: 'Name of the other person involved, if any' },
      direction: {
        type: ['string', 'null'],
        enum: ['owed_by_me', 'owed_to_me', null],
        description: 'Only for commitments: owed_by_me if I promised them, owed_to_me if they promised me',
      },
      confidence: { type: 'number', description: '0-1 honest probability for the chosen type' },
    },
    required: ['type', 'title', 'confidence'],
  },
};

const system = (now: Date) => `You classify one voice-memo transcript into exactly one type and extract entities.

Types:
- commitment: a promise between me and another specific person, either direction ("I told Priya I'd...", "Dana said she'd send me...").
- reminder: a time-anchored nudge to myself ("remind me at 9 to...").
- task: a personal to-do without a strong time anchor ("fix the deck intro").
- event: something that belongs on a calendar - has a date and usually a time or place ("dentist Tuesday 3:30").
- shopping: something to buy or pick up ("grab batteries").
- note: information to keep, nothing to do ("the wifi code is...").

Rules:
- due_iso: resolve relative phrases ("Thursday", "tomorrow morning", "tonight") against the current time below. Times of day: morning=09:00, afternoon=15:00, tonight=20:00. Date only if no time stated: use 18:00.
- person: the other human involved, if one is named.
- confidence is your honest probability that the chosen type is what the speaker wanted. If two types are genuinely plausible, it must be 0.7 or lower - a wrong silent filing is much worse than asking.
Current time: ${now.toISOString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`;

export async function classify(transcript: string, now = new Date()): Promise<Classification> {
  const out = await structured<Partial<Classification> & Pick<Classification, 'type' | 'title' | 'confidence'>>({
    system: system(now),
    user: transcript,
    tool: TOOL,
    maxTokens: 512,
  });
  return { due_iso: null, person: null, direction: null, ...out };
}
