import { useEffect, useState } from 'react';
import type { ItemWithSource, SourceMessage } from 'shared';
import { getJSON } from './api';

const DAY = 86_400_000;

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

export function ItemRow({ item, onOpen }: { item: ItemWithSource; onOpen: (i: ItemWithSource) => void }) {
  const due = fmtDue(item.due_at);
  const who = item.counterparty_name ?? item.counterparty_email ?? null;
  return (
    <button className="row" onClick={() => onOpen(item)}>
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
  onOpen: (i: ItemWithSource) => void;
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

export function TodayView({ items, onOpen }: { items: ItemWithSource[]; onOpen: (i: ItemWithSource) => void }) {
  const owed = items.filter((i) => i.type === 'commitment' && i.direction === 'owed_by_me' && i.status === 'open');
  const waiting = items.filter((i) => i.type === 'commitment' && i.direction === 'owed_to_me' && i.status === 'open');
  const recent = [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 8);
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

export function AskView() {
  return (
    <div>
      <div className="ask-box">
        <input disabled placeholder='Ask your inbox, e.g. "what did we decide about the caterer?"' />
      </div>
      <p className="muted empty">Ask-memory ships with T-13/T-14 (P1).</p>
    </div>
  );
}

export function SourceDrawer({ item, onClose }: { item: ItemWithSource; onClose: () => void }) {
  const [msg, setMsg] = useState<(SourceMessage & { subject?: string | null }) | null>(null);
  const [memo, setMemo] = useState<{ transcript: string | null } | null>(null);
  useEffect(() => {
    setMsg(null);
    setMemo(null);
    if (item.source_message_id) {
      getJSON<SourceMessage & { subject?: string | null }>(`/api/messages/${item.source_message_id}`).then(setMsg, () => {});
    } else if (item.source_memo_id) {
      getJSON<{ transcript: string | null }>(`/api/memos/${item.source_memo_id}`).then(setMemo, () => {});
    }
  }, [item]);
  return (
    <aside className="drawer">
      <div className="drawer-head">
        <strong>{item.title}</strong>
        <button className="ghost" onClick={onClose}>
          ✕
        </button>
      </div>
      {item.source_message_id ? (
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
    </aside>
  );
}
