import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ItemWithSource } from './api';
import { fmtDue, ItemRow } from './components';
import { C, MONO } from './theme';

function openCommitments(items: ItemWithSource[], direction: 'owed_by_me' | 'owed_to_me') {
  return items.filter((i) => i.type === 'commitment' && i.direction === direction && i.status === 'open');
}

// The single most overdue thing someone owes YOU — the best nudge candidate.
function mostOverdueWaiting(items: ItemWithSource[]): ItemWithSource | null {
  const now = Date.now();
  const overdue = openCommitments(items, 'owed_to_me').filter((i) => i.due_at && Date.parse(i.due_at) < now);
  overdue.sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!));
  return overdue[0] ?? null;
}

// Tapping a row: voice memos open their detail; things you're waiting on open a nudge draft.
function rowPress(
  item: ItemWithSource,
  onOpenMemoItem: (id: string) => void,
  onNudge: (item: ItemWithSource) => void
): (() => void) | undefined {
  if (item.source_memo_id) return () => onOpenMemoItem(item.source_memo_id!);
  if (item.type === 'commitment' && item.direction === 'owed_to_me' && item.status === 'open') return () => onNudge(item);
  return undefined;
}

// Proactive attention card: surfaces the most overdue "waiting on" and offers a nudge.
function AttentionCard({ item, onNudge }: { item: ItemWithSource; onNudge: (i: ItemWithSource) => void }) {
  const due = fmtDue(item.due_at);
  return (
    <Pressable onPress={() => onNudge(item)} style={({ pressed }) => [s.attn, pressed && s.attnPressed]}>
      <Text style={s.attnKicker}>Needs a nudge</Text>
      <Text style={s.attnTitle} numberOfLines={2}>
        {item.counterparty_name ?? 'Someone'} still owes you — {item.title}
      </Text>
      <View style={s.attnFoot}>
        {due && <Text style={s.attnDue}>{due.label}</Text>}
        <Text style={s.attnCta}>Draft a nudge →</Text>
      </View>
    </Pressable>
  );
}

export function TodayScreen({
  items,
  onOpenMemoItem,
  onNudge,
}: {
  items: ItemWithSource[];
  onOpenMemoItem: (memoId: string) => void;
  onNudge: (item: ItemWithSource) => void;
}) {
  const recent = [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 10);
  const waiting = mostOverdueWaiting(items);
  return (
    <FlatList
      data={recent}
      keyExtractor={(i) => i.id}
      contentContainerStyle={s.pad}
      ListHeaderComponent={
        <View>
          <View style={s.stats}>
            <View style={s.stat}>
              <Text style={s.statN}>{openCommitments(items, 'owed_by_me').length}</Text>
              <Text style={s.statL}>you owe</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statN}>{openCommitments(items, 'owed_to_me').length}</Text>
              <Text style={s.statL}>waiting on</Text>
            </View>
          </View>
          {waiting && <AttentionCard item={waiting} onNudge={onNudge} />}
          <Text style={s.h2}>Recently captured</Text>
        </View>
      }
      ListEmptyComponent={<Text style={s.empty}>Nothing yet — tap the mic and say it.</Text>}
      renderItem={({ item, index }) => (
        <ItemRow
          item={item}
          first={index === 0}
          last={index === recent.length - 1}
          onPress={rowPress(item, onOpenMemoItem, onNudge)}
        />
      )}
    />
  );
}

export function ItemsScreen({
  items,
  onOpenMemoItem,
  onNudge,
}: {
  items: ItemWithSource[];
  onOpenMemoItem: (memoId: string) => void;
  onNudge: (item: ItemWithSource) => void;
}) {
  const sorted = [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return (
    <FlatList
      data={sorted}
      keyExtractor={(i) => i.id}
      contentContainerStyle={s.pad}
      ListHeaderComponent={<Text style={s.h2}>All items</Text>}
      ListEmptyComponent={<Text style={s.empty}>No items yet.</Text>}
      renderItem={({ item, index }) => (
        <ItemRow
          item={item}
          first={index === 0}
          last={index === sorted.length - 1}
          onPress={rowPress(item, onOpenMemoItem, onNudge)}
        />
      )}
    />
  );
}

const s = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 130 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    backgroundColor: C.panel,
    borderRadius: 18,
    padding: 18,
  },
  statN: { color: C.text, fontSize: 38, fontWeight: '700', letterSpacing: -1.4, fontVariant: ['tabular-nums'] },
  statL: { color: C.muted, fontSize: 11, letterSpacing: 0.8, marginTop: 4, textTransform: 'uppercase', fontFamily: MONO },
  attn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    gap: 7,
  },
  attnPressed: { opacity: 0.7 },
  attnKicker: { color: C.text, fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.6, fontFamily: MONO },
  attnTitle: { color: C.text, fontSize: 16, fontWeight: '600', letterSpacing: -0.3, lineHeight: 22 },
  attnFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  attnDue: { color: C.danger, fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'], fontFamily: MONO },
  attnCta: { color: C.text, fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  h2: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontFamily: MONO,
    marginTop: 26,
    marginBottom: 10,
    marginLeft: 4,
  },
  empty: { color: C.muted, padding: 26, textAlign: 'center', backgroundColor: C.panel, borderRadius: 16 },
});
