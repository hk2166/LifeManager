import { google, type gmail_v1 } from 'googleapis';
import { convert } from 'html-to-text';
import { getAuthed } from '../google';
import { q } from '../db/index';

export function parseAddress(raw: string): { name: string | null; email: string } {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: raw.trim().toLowerCase() };
}

// cut top-posted reply tails so extraction doesn't double-read quoted history
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^On .{5,120} wrote:$/.test(t) || /^-+ ?Original Message ?-+$/i.test(t) || /^_{6,}$/.test(t)) {
      cut = i;
      break;
    }
  }
  const kept = lines.slice(0, cut);
  while (kept.length && (kept[kept.length - 1].trim() === '' || kept[kept.length - 1].startsWith('>'))) {
    kept.pop();
  }
  return kept.join('\n').trim();
}

const decodeB64 = (data: string) => Buffer.from(data, 'base64url').toString('utf8');

function findPart(p: gmail_v1.Schema$MessagePart, mime: string): gmail_v1.Schema$MessagePart | null {
  if (p.mimeType === mime && p.body?.data) return p;
  for (const c of p.parts ?? []) {
    const f = findPart(c, mime);
    if (f) return f;
  }
  return null;
}

export function extractBody(payload: gmail_v1.Schema$MessagePart): string {
  const plain = findPart(payload, 'text/plain');
  if (plain) return decodeB64(plain.body!.data!);
  const html = findPart(payload, 'text/html');
  if (html) {
    return convert(decodeB64(html.body!.data!), {
      wordwrap: false,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
      ],
    });
  }
  return '';
}

const header = (p: gmail_v1.Schema$MessagePart, name: string) =>
  p.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;

async function ingestMessage(gmail: gmail_v1.Gmail, id: string): Promise<boolean> {
  const exists = await q('SELECT 1 FROM messages WHERE id = $1', [id]);
  if (exists.rows.length) return false; // idempotent: re-runs skip known messages

  const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
  const p = data.payload;
  if (!p) return false;
  const from = parseAddress(header(p, 'From') ?? '');
  const to = (header(p, 'To') ?? '')
    .split(',')
    .map((a) => parseAddress(a).email)
    .filter(Boolean);
  const sentAt = new Date(Number(data.internalDate));
  const body = stripQuoted(extractBody(p));
  const threadId = data.threadId ?? id;

  await q(
    `INSERT INTO threads (id, subject, last_message_at) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET
       subject = COALESCE(threads.subject, EXCLUDED.subject),
       last_message_at = GREATEST(threads.last_message_at, EXCLUDED.last_message_at)`,
    [threadId, header(p, 'Subject'), sentAt]
  );
  await q(
    `INSERT INTO messages (id, thread_id, from_name, from_email, to_emails, sent_at, snippet, body_text)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
    [id, threadId, from.name, from.email, to, sentAt, data.snippet ?? body.slice(0, 120), body]
  );
  return true;
}

// cheap 2-min poll: idempotent fast-path makes re-listing recent mail nearly free
export async function syncRecent() {
  const gmail = google.gmail({ version: 'v1', auth: await getAuthed() });
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: 'newer_than:2d -in:spam -in:trash',
    maxResults: 50,
  });
  let ingested = 0;
  for (const m of list.data.messages ?? []) {
    if (await ingestMessage(gmail, m.id!)) ingested++;
  }
  if (ingested) console.log(`sync: ${ingested} new message(s)`);
  return ingested;
}

export async function backfill(days = 90) {
  const gmail = google.gmail({ version: 'v1', auth: await getAuthed() });
  let pageToken: string | undefined;
  let seen = 0;
  let ingested = 0;
  do {
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: `newer_than:${days}d -in:spam -in:trash`,
      maxResults: 100,
      pageToken,
    });
    pageToken = list.data.nextPageToken ?? undefined;
    for (const m of list.data.messages ?? []) {
      seen++;
      if (await ingestMessage(gmail, m.id!)) ingested++;
    }
  } while (pageToken);
  console.log(`backfill: ${seen} messages seen, ${ingested} newly ingested`);
}
