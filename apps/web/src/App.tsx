import { useEffect, useRef, useState } from 'react';
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
  const [target, setTarget] = useState<DrawerTarget | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: items, error } = usePoll<ItemWithSource[]>('/api/items');

  const openDrawer = (t: DrawerTarget) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setTarget(t);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    closeTimer.current = setTimeout(() => setTarget(null), 460); // unmount after exit animation
  };

  // add the .open class one tick after mount so the enter transition runs — setTimeout,
  // not rAF, so it still fires when the tab isn't focused
  useEffect(() => {
    if (!target) return;
    const id = setTimeout(() => setDrawerOpen(true), 15);
    return () => clearTimeout(id);
  }, [target]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDrawer();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeIndex = TABS.findIndex((t) => t.id === tab);

  return (
    <>
      <header className={scrolled ? 'chrome scrolled' : 'chrome'}>
        <div className="chrome-inner">
          <h1 className="brand"><span className="dot" />Life OS</h1>
          <div className="segmented" role="tablist" aria-label="Views">
            <div
              className="thumb"
              style={{ width: `calc((100% - 4px) / ${TABS.length})`, transform: `translateX(${activeIndex * 100}%)` }}
            />
            {TABS.map((t) => (
              <button
                key={t.id}
                className="seg"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="main">
        {error && <p className="banner">Can't reach the API — is `npm run dev` running? ({error})</p>}
        {tab === 'today' && <TodayView items={items ?? []} onOpen={openDrawer} />}
        {tab === 'commitments' && (
          <ItemList
            items={items ?? []}
            direction="owed_by_me"
            empty="Nothing owed. Either you're a saint or the extractor hasn't run."
            onOpen={openDrawer}
          />
        )}
        {tab === 'waiting' && (
          <ItemList items={items ?? []} direction="owed_to_me" empty="Not waiting on anyone." onOpen={openDrawer} />
        )}
        {tab === 'ask' && <AskView onOpen={openDrawer} />}
      </main>

      {target && (
        <>
          <div className={drawerOpen ? 'scrim open' : 'scrim'} onClick={closeDrawer} />
          <SourceDrawer target={target} open={drawerOpen} onClose={closeDrawer} />
        </>
      )}
    </>
  );
}
