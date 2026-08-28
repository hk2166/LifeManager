import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { confirmMemo, uploadMemo, type ItemType, type MemoResult } from './api';
import { TYPE_ICONS } from './components';
import { C } from './theme';

type Phase = 'starting' | 'recording' | 'uploading' | 'routed' | 'chip' | 'error';

const ALL_TYPES: ItemType[] = ['commitment', 'task', 'reminder', 'event', 'shopping', 'note'];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function MemoFlow({ onDone }: { onDone: () => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>('starting');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<MemoResult | null>(null);
  const [err, setErr] = useState('');
  const uriRef = useRef<string | null>(null); // survives failures so retry never loses audio
  const started = useRef(false);

  // one tap on the mic tab = already recording: auto-start on mount
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErr('Microphone permission denied - enable it in Settings.');
        setPhase('error');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    })().catch((e) => {
      setErr(String(e));
      setPhase('error');
    });
  }, [recorder]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const send = async (uri: string) => {
    try {
      setPhase('uploading');
      const r = await uploadMemo(uri);
      setResult(r);
      setPhase(r.needs_confirmation ? 'chip' : 'routed');
    } catch (e) {
      setErr(String(e));
      setPhase('error');
    }
  };

  const stopAndUpload = async () => {
    try {
      setPhase('uploading');
      await recorder.stop();
      if (!recorder.uri) throw new Error('no recording produced');
      uriRef.current = recorder.uri;
      await send(recorder.uri);
    } catch (e) {
      setErr(String(e));
      setPhase('error');
    }
  };

  const cancel = async () => {
    try {
      if (phase === 'recording') await recorder.stop();
    } catch {}
    onDone();
  };

  const pick = async (type: ItemType) => {
    if (!result) return;
    try {
      setPhase('uploading');
      const r = await confirmMemo(result.memo.id, type);
      setResult(r);
      setPhase('routed');
    } catch (e) {
      setErr(String(e));
      setPhase('error');
    }
  };

  return (
    <View style={s.wrap}>
      {phase === 'starting' && (
        <View style={s.center}>
          <ActivityIndicator color={C.accent} />
          <Text style={s.muted}>Getting the mic…</Text>
        </View>
      )}

      {phase === 'recording' && (
        <View style={s.center}>
          <View style={s.dot} />
          <Text style={s.timer}>{fmt(elapsed)}</Text>
          <Text style={s.muted}>Listening - just say it.</Text>
          <Pressable style={s.stop} onPress={stopAndUpload}>
            <Text style={s.stopText}>Stop</Text>
          </Pressable>
          <Pressable onPress={cancel}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {phase === 'uploading' && (
        <View style={s.center}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={s.muted}>Transcribing & filing…</Text>
        </View>
      )}

      {phase === 'chip' && result && (
        <View style={s.center}>
          <Text style={s.heard}>"{result.memo.transcript}"</Text>
          <Text style={s.ask}>Not sure - file this as?</Text>
          <View style={s.chips}>
            {[result.memo.suggested_type, ...ALL_TYPES.filter((t) => t !== result.memo.suggested_type)]
              .filter((t): t is ItemType => Boolean(t))
              .map((t, i) => (
                <Pressable key={t} style={[s.chip, i === 0 && s.chipSuggested]} onPress={() => pick(t)}>
                  <Text style={s.chipText}>
                    {TYPE_ICONS[t]} {t}
                    {i === 0 ? ' ✨' : ''}
                  </Text>
                </Pressable>
              ))}
          </View>
          <Pressable onPress={cancel}>
            <Text style={s.cancel}>Discard</Text>
          </Pressable>
        </View>
      )}

      {phase === 'routed' && result?.item && (
        <View style={s.center}>
          <Text style={s.big}>✓</Text>
          <Text style={s.routedTitle}>Added to {result.item.type}s</Text>
          <Text style={s.itemTitle}>{result.item.title}</Text>
          {result.item.due_at && (
            <Text style={s.muted}>due {new Date(result.item.due_at).toLocaleString()}</Text>
          )}
          <Pressable style={s.stop} onPress={onDone}>
            <Text style={s.stopText}>Done</Text>
          </Pressable>
        </View>
      )}

      {phase === 'error' && (
        <View style={s.center}>
          <Text style={s.errText}>{err}</Text>
          {uriRef.current && (
            <Pressable style={s.stop} onPress={() => send(uriRef.current!)}>
              <Text style={s.stopText}>Retry upload</Text>
            </Pressable>
          )}
          <Pressable onPress={cancel}>
            <Text style={s.cancel}>Close</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.rec },
  timer: { color: C.text, fontSize: 44, fontVariant: ['tabular-nums'], fontWeight: '200' },
  muted: { color: C.muted, fontSize: 14 },
  stop: {
    backgroundColor: C.accent,
    borderRadius: 999,
    paddingHorizontal: 42,
    paddingVertical: 14,
    marginTop: 10,
  },
  stopText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  cancel: { color: C.muted, fontSize: 15, padding: 8 },
  heard: { color: C.text, fontSize: 17, fontStyle: 'italic', textAlign: 'center' },
  ask: { color: C.muted, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    backgroundColor: C.panel,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipSuggested: { borderColor: C.accent, backgroundColor: C.chipBg },
  chipText: { color: C.text, fontSize: 14.5 },
  big: { fontSize: 44, color: '#7ac68b' },
  routedTitle: { color: C.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  itemTitle: { color: C.text, fontSize: 19, fontWeight: '600', textAlign: 'center' },
  errText: { color: '#f2b8b2', textAlign: 'center', fontSize: 14.5 },
});
