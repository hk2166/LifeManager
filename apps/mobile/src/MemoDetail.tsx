import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { API, getMemo, type Memo } from './api';
import { TYPE_ICONS } from './components';
import { C } from './theme';

const fmtTime = (s: number) => {
  const v = !isFinite(s) || s < 0 ? 0 : s;
  return `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
};

export function MemoDetail({ memoId, onClose }: { memoId: string; onClose: () => void }) {
  const [memo, setMemo] = useState<Memo | null>(null);
  const player = useAudioPlayer(`${API}/api/memos/${memoId}/audio`);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    getMemo(memoId).then(setMemo, () => {});
  }, [memoId]);

  const dur = status.duration || 0;
  const cur = status.currentTime || 0;
  const pct = dur > 0 ? Math.min(1, cur / dur) : 0;
  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish || cur >= (dur || Infinity)) player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={s.wrap}>
      <View style={s.grabber} />
      <View style={s.head}>
        <Text style={s.title}>Voice memo</Text>
        <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => pressed && s.dim}>
          <Text style={s.done}>Done</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <View style={s.player}>
          <Pressable onPress={toggle} style={({ pressed }) => [s.playBtn, pressed && s.playPressed]}>
            <Text style={s.playIcon}>{status.playing ? '⏸' : '▶'}</Text>
          </Pressable>
          <View style={s.progress}>
            <View style={s.track}>
              <View style={[s.fill, { width: `${pct * 100}%` }]} />
            </View>
            <View style={s.times}>
              <Text style={s.time}>{fmtTime(cur)}</Text>
              <Text style={s.time}>{fmtTime(dur)}</Text>
            </View>
          </View>
        </View>

        <Text style={s.label}>Transcript</Text>
        <View style={s.card}>
          <Text style={s.transcript}>{memo?.transcript ? `“${memo.transcript}”` : '…'}</Text>
        </View>

        {memo && (
          <View style={s.metaRow}>
            {memo.suggested_type && (
              <View style={s.metaChip}>
                <Text style={s.metaChipText}>
                  {TYPE_ICONS[memo.suggested_type]} {memo.suggested_type}
                </Text>
              </View>
            )}
            <Text style={s.meta}>
              {(Number(memo.confidence ?? 0) * 100).toFixed(0)}% sure · {memo.transcribe_ms ?? '?'}ms + {memo.classify_ms ?? '?'}ms
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: C.fill2, marginTop: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  title: { color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  done: { color: C.accent, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  dim: { opacity: 0.5 },
  body: { gap: 10, paddingBottom: 30 },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    backgroundColor: C.panel,
    borderRadius: 18,
    padding: 16,
  },
  playBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
  playIcon: { color: '#fff', fontSize: 19, marginLeft: 1 },
  progress: { flex: 1, gap: 8 },
  track: { height: 4, borderRadius: 2, backgroundColor: C.fill, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: C.accent },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: C.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  label: {
    color: C.muted,
    fontSize: 12.5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
    marginTop: 16,
    marginLeft: 4,
  },
  card: { backgroundColor: C.panel, borderRadius: 18, padding: 16 },
  transcript: { color: C.text, fontSize: 17, lineHeight: 25, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginLeft: 4, flexWrap: 'wrap' },
  metaChip: { backgroundColor: C.fill, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  metaChipText: { color: C.text, fontSize: 13, fontWeight: '500' },
  meta: { color: C.muted, fontSize: 12.5, fontVariant: ['tabular-nums'] },
});
