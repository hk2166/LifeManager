import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { ItemWithSource } from './api';
import { ItemRow } from './components';
import { C } from './theme';

function openCommitments(items: ItemWithSource[], direction: 'owed_by_me' | 'owed_to_me') {
  return items.filter((i) => i.type === 'commitment' && i.direction === direction && i.status === 'open');
}

export function TodayScreen({
  items,
  onOpenMemoItem,
}: {
  items: ItemWithSource[];
  onOpenMemoItem: (memoId: string) => void;
}) {
  const recent = [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 10);
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
          <Text style={s.h2}>Recently captured</Text>
        </View>
      }
      ListEmptyComponent={<Text style={s.empty}>Nothing yet — tap the mic and say it.</Text>}
      renderItem={({ item, index }) => (
        <ItemRow
          item={item}
          first={index === 0}
          last={index === recent.length - 1}
          onPress={item.source_memo_id ? () => onOpenMemoItem(item.source_memo_id!) : undefined}
        />
      )}
    />
  );
}

export function ItemsScreen({
  items,
  onOpenMemoItem,
}: {
  items: ItemWithSource[];
  onOpenMemoItem: (memoId: string) => void;
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
          onPress={item.source_memo_id ? () => onOpenMemoItem(item.source_memo_id!) : undefined}
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
  statL: { color: C.muted, fontSize: 13.5, letterSpacing: -0.2, marginTop: 2 },
  h2: {
    color: C.muted,
    fontSize: 12.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 26,
    marginBottom: 10,
    marginLeft: 4,
  },
  empty: { color: C.muted, padding: 26, textAlign: 'center', backgroundColor: C.panel, borderRadius: 16 },
});
