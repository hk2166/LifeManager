CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE threads (
  id text PRIMARY KEY,
  subject text,
  last_message_at timestamptz
);

CREATE TABLE messages (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES threads(id),
  from_name text,
  from_email text NOT NULL,
  to_emails text[] NOT NULL DEFAULT '{}',
  sent_at timestamptz NOT NULL,
  snippet text,
  body_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread_idx ON messages (thread_id, sent_at);

CREATE TABLE events (
  id text PRIMARY KEY,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  attendees jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_path text,
  transcript text,
  status text NOT NULL DEFAULT 'pending',
  suggested_type text,
  confidence real,
  entities jsonb,
  item_id uuid,
  transcribe_ms int,
  classify_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('commitment','task','reminder','note','event','shopping')),
  direction text CHECK (direction IN ('owed_by_me','owed_to_me')),
  title text NOT NULL,
  counterparty_name text,
  counterparty_email text,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  confidence real,
  source_kind text NOT NULL CHECK (source_kind IN ('email','memo')),
  source_message_id text REFERENCES messages(id),
  source_memo_id uuid REFERENCES memos(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_type_idx ON items (type, direction, due_at);

ALTER TABLE memos
  ADD CONSTRAINT memos_item_fk FOREIGN KEY (item_id) REFERENCES items(id);

-- single-user token store for the demo Google account
CREATE TABLE google_tokens (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tokens jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- idempotency marker so re-running extraction never duplicates items
CREATE TABLE extraction_state (
  thread_id text PRIMARY KEY REFERENCES threads(id),
  last_message_id text NOT NULL,
  extracted_at timestamptz NOT NULL DEFAULT now()
);
