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

export function ItemRow({
  item,
  onPress,
  first,
  last,
}: {
  item: ItemWithSource;
  onPress?: () => void;
  first?: boolean;
  last?: boolean;
}) {
  const due = fmtDue(item.due_at);
  const who = item.counterparty_name ?? item.counterparty_email;
  return (
    <Pressable
      style={({ pressed }) => [s.row, first && s.first, last && s.last, pressed && onPress ? s.pressed : null]}
      onPress={onPress}
      disabled={!onPress}
    >
      {!first && <View style={s.sep} />}
      <Text style={s.icon}>{TYPE_ICONS[item.type] ?? '•'}</Text>
      <View style={s.main}>
        <Text style={s.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {[who, item.source_kind === 'memo' ? 'voice memo' : item.source?.subject].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {due && (
        <View style={[s.duePill, due.overdue && s.duePillOver]}>
          <Text style={[s.due, due.overdue && s.overdue]}>{due.label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: C.panel,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  first: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  last: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  pressed: { backgroundColor: C.panel2 },
  sep: { position: 'absolute', top: 0, left: 52, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: C.hairline },
  icon: { fontSize: 17 },
  main: { flex: 1, gap: 2 },
  title: { color: C.text, fontWeight: '600', fontSize: 15.5, letterSpacing: -0.2 },
  sub: { color: C.muted, fontSize: 12.5, letterSpacing: -0.1 },
  duePill: {
    backgroundColor: C.fill,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  duePillOver: { backgroundColor: C.dangerBg },
  due: { color: C.muted, fontSize: 11.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  overdue: { color: C.danger },
});
