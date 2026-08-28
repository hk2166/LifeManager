import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { API, getMemo, type Memo } from './api';
import { C } from './theme';

export function MemoDetail({ memoId, onClose }: { memoId: string; onClose: () => void }) {
  const [memo, setMemo] = useState<Memo | null>(null);
  const player = useAudioPlayer(`${API}/api/memos/${memoId}/audio`);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    getMemo(memoId).then(setMemo, () => {});
  }, [memoId]);

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.title}>Voice memo</Text>
        <Pressable onPress={onClose}>
          <Text style={s.close}>✕</Text>
        </Pressable>
      </View>
      <Pressable
        style={({ pressed }) => [s.play, pressed && { opacity: 0.7 }]}
        onPress={() => {
          if (status.playing) player.pause();
          else {
            if (status.didJustFinish || status.currentTime >= (status.duration || Infinity)) player.seekTo(0);
            player.play();
          }
        }}
      >
        <Text style={s.playText}>{status.playing ? '⏸ Pause audio' : '▶ Play audio'}</Text>
      </Pressable>
      <Text style={s.label}>Transcript</Text>
      <Text style={s.transcript}>{memo?.transcript ?? '…'}</Text>
      {memo && (
        <Text style={s.meta}>
          classified {memo.suggested_type ?? '?'} at {(Number(memo.confidence ?? 0) * 100).toFixed(0)}% ·
          transcribe {memo.transcribe_ms ?? '?'}ms · classify {memo.classify_ms ?? '?'}ms
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: 20, gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: C.text, fontSize: 18, fontWeight: '650' as never },
  close: { color: C.muted, fontSize: 18, padding: 6 },
  play: {
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  playText: { color: C.accent, fontSize: 15.5, fontWeight: '600' },
  label: { color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  transcript: { color: C.text, fontSize: 16, lineHeight: 23 },
  meta: { color: C.muted, fontSize: 12.5, marginTop: 8 },
});
