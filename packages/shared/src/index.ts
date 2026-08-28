export type ItemType = 'commitment' | 'task' | 'reminder' | 'note' | 'event' | 'shopping';
export type Direction = 'owed_by_me' | 'owed_to_me';
export type ItemStatus = 'open' | 'done';

export const ITEM_TYPES: ItemType[] = ['commitment', 'task', 'reminder', 'note', 'event', 'shopping'];

export interface Item {
  id: string;
  type: ItemType;
  direction: Direction | null;
  title: string;
  counterparty_name: string | null;
  counterparty_email: string | null;
  due_at: string | null;
  status: ItemStatus;
  confidence: number | null;
  source_kind: 'email' | 'memo';
  source_message_id: string | null;
  source_memo_id: string | null;
  created_at: string;
}

export interface SourceMessage {
  id: string;
  thread_id: string;
  subject: string | null;
  from_name: string | null;
  from_email: string;
  sent_at: string;
  body_text: string;
  gmail_url: string;
}

export interface ItemWithSource extends Item {
  source: Pick<SourceMessage, 'id' | 'subject' | 'from_name' | 'from_email' | 'sent_at' | 'gmail_url'> | null;
}

export type MemoStatus = 'routed' | 'pending_confirmation' | 'failed';

export interface MemoEntities {
  title: string;
  due_iso: string | null;
  person: string | null;
}

export interface Memo {
  id: string;
  transcript: string | null;
  status: MemoStatus;
  suggested_type: ItemType | null;
  confidence: number | null;
  entities: MemoEntities | null;
  item_id: string | null;
  transcribe_ms: number | null;
  classify_ms: number | null;
  created_at: string;
}

export interface MemoResult {
  memo: Memo;
  item: Item | null;
  needs_confirmation: boolean;
}

export interface EventRow {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  attendees: { name: string; email: string }[];
}

export interface AskSource {
  id: string;
  subject: string | null;
  from_name: string | null;
  from_email: string;
  sent_at: string;
  gmail_url: string;
}

export interface AskResult {
  answer: string;
  confident: boolean;
  sources: AskSource[];
}

export interface Brief {
  event: EventRow;
  headline: string;
  bullets: string[];
  ms: number;
}

export interface Digest {
  digest: string;
  ms: number;
}

export interface NudgeDraft {
  subject: string;
  body: string;
}
