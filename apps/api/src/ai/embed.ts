import { OPENAI_API_KEY } from '../config';
import { q } from '../db/index';

// same key as whisper - one less signup than a dedicated embeddings provider
const MODEL = 'text-embedding-3-small'; // 1536 dims, matches migrations/002

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`embeddings failed: ${res.status} ${await res.text()}`);
  const { data } = (await res.json()) as { data: { embedding: number[] }[] };
  return data.map((d) => d.embedding);
}

export async function embedMissing() {
  const { rows } = await q<{ id: string; subject: string | null; body_text: string }>(
    `SELECT m.id, t.subject, m.body_text
     FROM messages m JOIN threads t ON t.id = m.thread_id
     WHERE m.embedding IS NULL ORDER BY m.sent_at LIMIT 100`
  );
  if (!rows.length) return 0;
  const vecs = await embedTexts(rows.map((r) => `${r.subject ?? ''}\n${r.body_text}`.slice(0, 6000)));
  for (let i = 0; i < rows.length; i++) {
    await q('UPDATE messages SET embedding = $1::vector WHERE id = $2', [JSON.stringify(vecs[i]), rows[i].id]);
  }
  console.log(`embedded ${rows.length} message(s)`);
  return rows.length;
}

export interface Hit {
  id: string;
  from_name: string | null;
  from_email: string;
  sent_at: Date;
  body_text: string;
  subject: string | null;
}

export async function searchMessages(query: string, userId: string, k = 8): Promise<Hit[]> {
  const [vec] = await embedTexts([query]);
  const { rows } = await q<Hit>(
    `SELECT m.id, m.from_name, m.from_email, m.sent_at, m.body_text, t.subject
     FROM messages m JOIN threads t ON t.id = m.thread_id
     WHERE m.user_id = $2 AND m.embedding IS NOT NULL
     ORDER BY m.embedding <=> $1::vector
     LIMIT $3`,
    [JSON.stringify(vec), userId, k]
  );
  return rows;
}
