import { useEffect, useState } from 'react';
import type { AskResult, Brief, Digest, EventRow, ItemWithSource, NudgeDraft, SourceMessage } from 'shared';
import { getJSON, postJSON, usePoll } from './api';

const DAY = 86_400_000;

export interface DrawerTarget {
  title: string;
  messageId?: string;
  memoId?: string;
  item?: ItemWithSource;
}

export const itemTarget = (item: ItemWithSource): DrawerTarget => ({
  title: item.title,
  messageId: item.source_message_id ?? undefined,
  memoId: item.source_memo_id ?? undefined,
  item,
});

export function fmtDue(iso: string | null): { label: string; overdue: boolean } | null {
  if (!iso) return null;
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((due.getTime() - today.getTime()) / DAY);
  if (days < 0) return { label: `${-days}d overdue`, overdue: true };
  if (days === 0) return { label: 'today', overdue: false };
  if (days === 1) return { label: 'tomorrow', overdue: false };
  return {
    label: due.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    overdue: false,
  };
}

function byDue(a: ItemWithSource, b: ItemWithSource) {
  if (!a.due_at && !b.due_at) return 0;
  if (!a.due_at) return 1;
  if (!b.due_at) return -1;
  return Date.parse(a.due_at) - Date.parse(b.due_at);
}

export function ItemRow({ item, onOpen }: { item: ItemWithSource; onOpen: (t: DrawerTarget) => void }) {
  const due = fmtDue(item.due_at);
  const who = item.counterparty_name ?? item.counterparty_email;
  return (
    <button className="row" onClick={() => onOpen(itemTarget(item))}>
      <div className="row-main">
        <span className="row-title">{item.title}</span>
        <span className="row-sub">
          {who && <span className="chip">{who}</span>}
          {item.source_kind === 'memo' ? (
            <span className="src">🎤 voice memo</span>
          ) : (
            item.source && <span className="src">✉ {item.source.subject ?? 'email'}</span>
          )}
        </span>
      </div>
      {due && <span className={`due ${due.overdue ? 'overdue' : ''}`}>{due.label}</span>}
    </button>
  );
}

export function ItemList({
  items,
  direction,
  empty,
  onOpen,
}: {
  items: ItemWithSource[];
  direction: 'owed_by_me' | 'owed_to_me';
  empty: string;
  onOpen: (t: DrawerTarget) => void;
}) {
  const list = items
    .filter((i) => i.type === 'commitment' && i.direction === direction && i.status === 'open')
    .sort(byDue);
  if (!list.length) return <p className="muted empty">{empty}</p>;
  return (
    <div className="list">
      {list.map((i) => (
        <ItemRow key={i.id} item={i} onOpen={onOpen} />
      ))}
    </div>
  );
}

function MeetingCard({ ev, onOpen }: { ev: EventRow; onOpen: (t: DrawerTarget) => void }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  void onOpen;
  const load = () => {
    setBusy(true);
    setErr('');
    getJSON<Brief>(`/api/events/${ev.id}/brief`)
      .then(setBrief)
      .catch((e) => setErr(String(e.message ?? e)))
      .finally(() => setBusy(false));
  };
  const start = new Date(ev.start_at);
  return (
    <div className="card">
      <div className="card-row">
        <div>
          <div className="card-title">{ev.title}</div>
          <div className="muted small">
            {start.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            {ev.attendees.length > 0 && ` · with ${ev.attendees.map((a) => a.name).join(', ')}`}
          </div>
        </div>
        <button className="btn" onClick={load} disabled={busy}>
          {busy ? 'Prepping…' : brief ? 'Refresh brief' : 'Prep brief'}
        </button>
      </div>
      {err && <p className="warn">{err}</p>}
      {brief && (
        <div className="brief">
          <p className="brief-headline">{brief.headline}</p>
          <ul className="bullets">
            {brief.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <span className="muted tiny">generated in {(brief.ms / 1000).toFixed(1)}s</span>
        </div>
      )}
    </div>
  );
}

function DigestCard() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = () => {
    setBusy(true);
    setErr('');
    getJSON<Digest>('/api/digest')
      .then(setDigest)
      .catch((e) => setErr(String(e.message ?? e)))
      .finally(() => setBusy(false));
  };
  return (
    <div className="card">
      <div className="card-row">
        <div className="card-title">End-of-day digest</div>
        <button className="btn" onClick={load} disabled={busy}>
          {busy ? 'Writing…' : 'Generate'}
        </button>
      </div>
      {err && <p className="warn">{err}</p>}
      {digest && <p className="digest">{digest.digest}</p>}
    </div>
  );
}

export function TodayView({ items, onOpen }: { items: ItemWithSource[]; onOpen: (t: DrawerTarget) => void }) {
  const { data: events } = usePoll<EventRow[]>('/api/events', 30_000);
  const owed = items.filter((i) => i.type === 'commitment' && i.direction === 'owed_by_me' && i.status === 'open');
  const waiting = items.filter((i) => i.type === 'commitment' && i.direction === 'owed_to_me' && i.status === 'open');
  const upcoming = items
    .filter((i) => i.type !== 'commitment' && i.status === 'open' && i.due_at && Date.parse(i.due_at) > Date.now())
    .sort(byDue)
    .slice(0, 5);
  const recent = [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 8);
  const next = events?.[0];
  return (
    <div>
      <div className="stats">
        <div className="stat">
          <div className="stat-n">{owed.length}</div>
          <div className="stat-l">you owe</div>
        </div>
        <div className="stat">
          <div className="stat-n">{waiting.length}</div>
          <div className="stat-l">waiting on others</div>
        </div>
      </div>
      {next && (
        <>
          <h2>Next meeting</h2>
          <MeetingCard ev={next} onOpen={onOpen} />
        </>
      )}
      <h2>Digest</h2>
      <DigestCard />
      {upcoming.length > 0 && (
        <>
          <h2>Coming up</h2>
          <div className="list">
            {upcoming.map((i) => (
              <ItemRow key={i.id} item={i} onOpen={onOpen} />
            ))}
          </div>
        </>
      )}
      <h2>Recently captured</h2>
      {recent.length ? (
        <div className="list">
          {recent.map((i) => (
            <ItemRow key={i.id} item={i} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <p className="muted empty">Nothing yet - run the extractor or speak a memo.</p>
      )}
    </div>
  );
}

export function AskView({ onOpen }: { onOpen: (t: DrawerTarget) => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AskResult | null>(null);
  const [err, setErr] = useState('');
  const submit = () => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setErr('');
    setRes(null);
    postJSON<AskResult>('/api/ask', { question: q.trim() })
      .then(setRes)
      .catch((e) => setErr(String(e.message ?? e)))
      .finally(() => setBusy(false));
  };
  return (
    <div>
      <div className="ask-box">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder='Ask your inbox, e.g. "what did we decide about the caterer?"'
        />
        <button className="btn" onClick={submit} disabled={busy}>
          {busy ? 'Searching…' : 'Ask'}
        </button>
      </div>
      {err && <p className="warn">{err}</p>}
      {res && (
        <div className="card">
          <p className="digest">
            {res.answer} {!res.confident && <span className="lowconf">low confidence</span>}
          </p>
          {res.sources.length > 0 && (
            <div className="src-chips">
              {res.sources.map((s) => (
                <button
                  key={s.id}
                  className="src-chip"
                  onClick={() => onOpen({ title: s.subject ?? 'Source email', messageId: s.id })}
                >
                  ✉ {s.subject ?? s.from_email}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!res && !err && <p className="muted empty">Answers come with the exact source email attached.</p>}
    </div>
  );
}

export function SourceDrawer({ target, onClose }: { target: DrawerTarget; onClose: () => void }) {
  const [msg, setMsg] = useState<(SourceMessage & { subject?: string | null }) | null>(null);
  const [memo, setMemo] = useState<{ transcript: string | null } | null>(null);
  const [nudge, setNudge] = useState<NudgeDraft | null>(null);
  const [nudging, setNudging] = useState(false);
  const [nudgeErr, setNudgeErr] = useState('');
  const [copied, setCopied] = useState(false);
  const canNudge = target.item?.type === 'commitment' && target.item?.direction === 'owed_to_me';

  useEffect(() => {
    setMsg(null);
    setMemo(null);
    setNudge(null);
    setNudgeErr('');
    setCopied(false);
    if (target.messageId) {
      getJSON<SourceMessage & { subject?: string | null }>(`/api/messages/${target.messageId}`).then(setMsg, () => {});
    } else if (target.memoId) {
      getJSON<{ transcript: string | null }>(`/api/memos/${target.memoId}`).then(setMemo, () => {});
    }
  }, [target]);

  const draft = () => {
    if (!target.item) return;
    setNudging(true);
    setNudgeErr('');
    postJSON<NudgeDraft>(`/api/items/${target.item.id}/nudge`, {})
      .then(setNudge)
      .catch((e) => setNudgeErr(String(e.message ?? e)))
      .finally(() => setNudging(false));
  };

  const copy = () => {
    if (!nudge) return;
    navigator.clipboard.writeText(`Subject: ${nudge.subject}\n\n${nudge.body}`).then(() => setCopied(true));
  };

  return (
    <aside className="drawer">
      <div className="drawer-head">
        <strong>{target.title}</strong>
        <button className="ghost" onClick={onClose}>
          ✕
        </button>
      </div>
      {target.messageId ? (
        msg ? (
          <div className="drawer-body">
            <div className="msg-meta">
              <div className="msg-subject">{msg.subject ?? '(no subject)'}</div>
              <div className="muted">
                {msg.from_name ?? msg.from_email} · {new Date(msg.sent_at).toLocaleString()}
              </div>
            </div>
            <pre className="msg-body">{msg.body_text}</pre>
            <a className="link" href={msg.gmail_url} target="_blank" rel="noreferrer">
              Open in Gmail ↗
            </a>
          </div>
        ) : (
          <p className="muted empty">Loading source…</p>
        )
      ) : memo ? (
        <div className="drawer-body">
          <div className="msg-meta">
            <div className="msg-subject">Voice memo transcript</div>
          </div>
          <pre className="msg-body">{memo.transcript ?? '(no transcript)'}</pre>
        </div>
      ) : (
        <p className="muted empty">Loading…</p>
      )}
      {canNudge && (
        <div className="nudge">
          <button className="btn" onClick={draft} disabled={nudging}>
            {nudging ? 'Drafting…' : 'Draft a nudge'}
          </button>
          {nudgeErr && <p className="warn">{nudgeErr}</p>}
          {nudge && (
            <div className="nudge-draft">
              <div className="msg-subject">{nudge.subject}</div>
              <pre className="msg-body">{nudge.body}</pre>
              <button className="btn subtle" onClick={copy}>
                {copied ? 'Copied ✓' : 'Copy - nothing is ever auto-sent'}
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
