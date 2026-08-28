import { google } from 'googleapis';
import { getAuthed } from '../google';
import { q } from '../db/index';
import { parseAddress } from './gmail';

// next 7 days from the primary calendar; recurring events arrive pre-expanded (singleEvents)
export async function syncCalendar(userId: string, days = 7) {
  const cal = google.calendar({ version: 'v3', auth: await getAuthed(userId) });
  const now = new Date();
  const { data } = await cal.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + days * 86_400_000).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  });
  let count = 0;
  for (const e of data.items ?? []) {
    if (!e.id || !e.start) continue;
    const start = e.start.dateTime ?? (e.start.date ? `${e.start.date}T09:00:00` : null);
    if (!start) continue;
    const end = e.end?.dateTime ?? null;
    const attendees = (e.attendees ?? [])
      .filter((a) => a.email && !a.self)
      .map((a) => ({ name: a.displayName ?? parseAddress(a.email!).name ?? a.email, email: a.email!.toLowerCase() }));
    await q(
      `INSERT INTO events (id, user_id, title, start_at, end_at, attendees) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, start_at = EXCLUDED.start_at,
         end_at = EXCLUDED.end_at, attendees = EXCLUDED.attendees`,
      [e.id, userId, e.summary ?? '(untitled)', new Date(start), end ? new Date(end) : null, JSON.stringify(attendees)]
    );
    count++;
  }
  console.log(`calendar: synced ${count} event(s)`);
}
