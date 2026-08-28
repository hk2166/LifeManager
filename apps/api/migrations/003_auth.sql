CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Every data table gets an owner. Nullable so the migration applies to existing
-- (pre-auth) rows; the app always sets it on insert. Old orphan rows (null) are
-- invisible because every query filters by user_id.
ALTER TABLE threads ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE items ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE memos ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- google_tokens was single-row (id=1); make it one row per user
DROP TABLE IF EXISTS google_tokens;
CREATE TABLE google_tokens (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tokens jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX threads_user_idx ON threads(user_id);
CREATE INDEX messages_user_idx ON messages(user_id);
CREATE INDEX events_user_idx ON events(user_id);
CREATE INDEX items_user_idx ON items(user_id);
CREATE INDEX memos_user_idx ON memos(user_id);
