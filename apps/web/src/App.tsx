import { useState } from 'react';
import type { ItemWithSource } from 'shared';
import { usePoll } from './api';
import { AskView, ItemList, SourceDrawer, TodayView, type DrawerTarget } from './views';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'commitments', label: 'Commitments' },
  { id: 'waiting', label: 'Waiting On' },
  { id: 'ask', label: 'Ask' },
] as const;

type Tab = (typeof TABS)[number]['id'];

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [open, setOpen] = useState<DrawerTarget | null>(null);
  const { data: items, error } = usePoll<ItemWithSource[]>('/api/items');

  return (
    <div className="shell">
      <header>
        <h1>Life OS</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {error && <p className="banner">API unreachable - is `npm run dev` running? ({error})</p>}
        {tab === 'today' && <TodayView items={items ?? []} onOpen={setOpen} />}
        {tab === 'commitments' && (
          <ItemList
            items={items ?? []}
            direction="owed_by_me"
            empty="Nothing owed. Either you're a saint or the extractor hasn't run."
            onOpen={setOpen}
          />
        )}
        {tab === 'waiting' && (
          <ItemList items={items ?? []} direction="owed_to_me" empty="Not waiting on anyone." onOpen={setOpen} />
        )}
        {tab === 'ask' && <AskView onOpen={setOpen} />}
      </main>
      {open && <SourceDrawer target={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
