import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getNudge, type ItemWithSource, type NudgeDraft } from './api';
import { C } from './theme';

// Smart nudge: an AI-drafted follow-up email for something you're waiting on.
// It is never sent — the user copies it (long-press) and sends it themselves.
export function NudgeSheet({ item, onClose }: { item: ItemWithSource; onClose: () => void }) {
  const [draft, setDraft] = useState<NudgeDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    setDraft(null);
    getNudge(item.id)
      .then(setDraft)
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [item.id]);

  const who = item.counterparty_name ?? item.counterparty_email ?? 'them';
  return (
    <View style={s.wrap}>
      <View style={s.grabber} />
      <View style={s.head}>
        <Text style={s.title}>Nudge {who}</Text>
        <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => pressed && s.dim}>
          <Text style={s.done}>Done</Text>
        </Pressable>
      </View>
      <Text style={s.sub} numberOfLines={2}>
        Waiting on: {item.title}
      </Text>

      <ScrollView contentContainerStyle={s.body}>
        {loading && (
          <View style={s.center}>
            <ActivityIndicator color={C.accent} />
            <Text style={s.muted}>Drafting a friendly follow-up…</Text>
          </View>
        )}
        {!!err && <Text style={s.err}>{err}</Text>}
        {draft && (
          <View style={s.card}>
            <Text style={s.label}>Subject</Text>
            <Text selectable style={s.subject}>
              {draft.subject}
            </Text>
            <View style={s.rule} />
            <Text selectable style={s.bodyText}>
              {draft.body}
            </Text>
          </View>
        )}
        {draft && (
          <Pressable onPress={load} style={({ pressed }) => [s.regen, pressed && s.dim]}>
            <Text style={s.regenTxt}>↻ Regenerate</Text>
          </Pressable>
        )}
        {draft && <Text style={s.foot}>Long-press the text to copy. Life OS never sends anything for you.</Text>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: C.fill2, marginTop: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingBottom: 2 },
  title: { color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  done: { color: C.accent, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  dim: { opacity: 0.5 },
  sub: { color: C.muted, fontSize: 14, letterSpacing: -0.1, marginBottom: 6 },
  body: { gap: 14, paddingTop: 12, paddingBottom: 40 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  muted: { color: C.muted, fontSize: 14.5, letterSpacing: -0.1 },
  err: { color: C.danger, fontSize: 14.5, textAlign: 'center', paddingVertical: 20 },
  card: { backgroundColor: C.panel, borderRadius: 18, padding: 18, gap: 12 },
  label: { color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },
  subject: { color: C.text, fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.hairline },
  bodyText: { color: C.text, fontSize: 16, lineHeight: 24, letterSpacing: -0.2 },
  regen: { alignSelf: 'flex-start', backgroundColor: C.fill, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  regenTxt: { color: C.accent, fontSize: 14.5, fontWeight: '600', letterSpacing: -0.2 },
  foot: { color: C.faint, fontSize: 12.5, letterSpacing: -0.1, lineHeight: 18 },
});
