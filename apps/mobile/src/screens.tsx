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
      ListEmptyComponent={<Text style={s.empty}>Nothing yet - tap the mic and say it.</Text>}
      renderItem={({ item }) => (
        <ItemRow item={item} onPress={item.source_memo_id ? () => onOpenMemoItem(item.source_memo_id!) : undefined} />
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
      ListEmptyComponent={<Text style={s.empty}>No items yet.</Text>}
      renderItem={({ item }) => (
        <ItemRow item={item} onPress={item.source_memo_id ? () => onOpenMemoItem(item.source_memo_id!) : undefined} />
      )}
    />
  );
}

const s = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 120 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  statN: { color: C.text, fontSize: 26, fontWeight: '700' },
  statL: { color: C.muted, fontSize: 12.5 },
  h2: {
    color: C.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  empty: { color: C.muted, padding: 24, textAlign: 'center' },
});
