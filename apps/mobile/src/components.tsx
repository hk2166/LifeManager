import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ItemWithSource } from './api';
import { C } from './theme';

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

export const TYPE_ICONS: Record<string, string> = {
  commitment: '🤝',
  task: '☑️',
  reminder: '⏰',
  note: '📝',
  event: '📅',
  shopping: '🛒',
};

export function ItemRow({ item, onPress }: { item: ItemWithSource; onPress?: () => void }) {
  const due = fmtDue(item.due_at);
  const who = item.counterparty_name ?? item.counterparty_email;
  return (
    <Pressable style={s.row} onPress={onPress} disabled={!onPress}>
      <Text style={s.icon}>{TYPE_ICONS[item.type] ?? '•'}</Text>
      <View style={s.main}>
        <Text style={s.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {[who, item.source_kind === 'memo' ? 'voice memo' : item.source?.subject].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {due && <Text style={[s.due, due.overdue && s.overdue]}>{due.label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  icon: { fontSize: 18 },
  main: { flex: 1, gap: 2 },
  title: { color: C.text, fontWeight: '600', fontSize: 15 },
  sub: { color: C.muted, fontSize: 12.5 },
  due: {
    color: C.muted,
    fontSize: 11.5,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  overdue: { color: '#f2b8b2', borderColor: C.danger },
});
