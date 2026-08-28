import { pool } from '../src/db/index';
import { DEMO_OWNER_EMAIL, DEMO_OWNER_NAME } from '../src/config';
import { buildCorpus, type SeedPerson } from './corpus';

export async function runSeed() {
  const owner: SeedPerson = { name: DEMO_OWNER_NAME, email: DEMO_OWNER_EMAIL };
  const { threads, events } = buildCorpus(owner);
  const now = Date.now();
  let msgCount = 0;
  const planted = { owed_by_me: 0, owed_to_me: 0 };

  for (const t of threads) {
    const participants = new Map<string, SeedPerson>();
    participants.set(owner.email, owner);
    for (const m of t.messages) {
      const p = m.from === 'owner' ? owner : m.from;
      participants.set(p.email, p);
    }
    const sentTimes = t.messages.map((m) => {
      const d = new Date(now - m.days_ago * 86_400_000);
      d.setHours(m.hour, (m.days_ago * 7 + m.hour * 13) % 60, 0, 0);
      return d;
    });
    const last = new Date(Math.max(...sentTimes.map((d) => d.getTime())));
    await pool.query(
      `INSERT INTO threads (id, subject, last_message_at) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, last_message_at = EXCLUDED.last_message_at`,
      [t.id, t.subject, last]
    );
    for (let i = 0; i < t.messages.length; i++) {
      const m = t.messages[i];
      const from = m.from === 'owner' ? owner : m.from;
      const to = [...participants.values()].filter((p) => p.email !== from.email).map((p) => p.email);
      await pool.query(
        `INSERT INTO messages (id, thread_id, from_name, from_email, to_emails, sent_at, snippet, body_text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET body_text = EXCLUDED.body_text, sent_at = EXCLUDED.sent_at`,
        [`${t.id}-m${i + 1}`, t.id, from.name, from.email, to, sentTimes[i], m.body.slice(0, 120), m.body]
      );
      msgCount++;
    }
    for (const e of t.expect) planted[e.direction]++;
  }

  for (const e of events) {
    const start = new Date(now + e.days_from_now * 86_400_000);
    start.setHours(e.hour, 0, 0, 0);
    const end = new Date(start.getTime() + e.duration_min * 60_000);
    await pool.query(
      `INSERT INTO events (id, title, start_at, end_at, attendees) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, start_at = EXCLUDED.start_at,
         end_at = EXCLUDED.end_at, attendees = EXCLUDED.attendees`,
      [e.id, e.title, start, end, JSON.stringify(e.attendees)]
    );
  }

  console.log(`seeded ${threads.length} threads, ${msgCount} messages, ${events.length} events`);
  console.log(`planted commitments: ${planted.owed_by_me} owed_by_me, ${planted.owed_to_me} owed_to_me`);
}

if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
