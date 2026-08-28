import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const pulse = useRef(new Animated.Value(1)).current;

  // breathing pulse on the record dot — disabled under reduce-motion
  useEffect(() => {
    if (phase !== 'recording') return;
    let anim: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.35, duration: 750, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        ])
      );
      anim.start();
    });
    return () => anim?.stop();
  }, [phase, pulse]);

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
          <Animated.View
            style={[s.dot, { opacity: pulse, transform: [{ scale: pulse.interpolate({ inputRange: [0.35, 1], outputRange: [0.82, 1] }) }] }]}
          />
          <Text style={s.timer}>{fmt(elapsed)}</Text>
          <Text style={s.muted}>Listening — just say it.</Text>
          <Pressable style={({ pressed }) => [s.stop, pressed && s.pressed]} onPress={stopAndUpload}>
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
          <Text style={s.ask}>Not sure — file this as?</Text>
          <View style={s.chips}>
            {[result.memo.suggested_type, ...ALL_TYPES.filter((t) => t !== result.memo.suggested_type)]
              .filter((t): t is ItemType => Boolean(t))
              .map((t, i) => (
                <Pressable
                  key={t}
                  style={({ pressed }) => [s.chip, i === 0 && s.chipSuggested, pressed && s.chipPressed]}
                  onPress={() => pick(t)}
                >
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
          <Pressable style={({ pressed }) => [s.stop, pressed && s.pressed]} onPress={onDone}>
            <Text style={s.stopText}>Done</Text>
          </Pressable>
        </View>
      )}

      {phase === 'error' && (
        <View style={s.center}>
          <Text style={s.errText}>{err}</Text>
          {uriRef.current && (
            <Pressable style={({ pressed }) => [s.stop, pressed && s.pressed]} onPress={() => send(uriRef.current!)}>
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
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.rec,
    shadowColor: C.rec,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  timer: { color: C.text, fontSize: 52, fontVariant: ['tabular-nums'], fontWeight: '200', letterSpacing: -1 },
  muted: { color: C.muted, fontSize: 14.5, letterSpacing: -0.1 },
  stop: {
    backgroundColor: C.accent,
    borderRadius: 999,
    paddingHorizontal: 46,
    paddingVertical: 15,
    marginTop: 12,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  stopText: { color: '#fff', fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  cancel: { color: C.muted, fontSize: 15, padding: 8 },
  heard: { color: C.text, fontSize: 18, fontStyle: 'italic', textAlign: 'center', letterSpacing: -0.3, lineHeight: 25 },
  ask: { color: C.muted, fontSize: 14.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'center' },
  chip: {
    backgroundColor: C.panel,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  chipSuggested: { backgroundColor: C.accent },
  chipPressed: { opacity: 0.6 },
  chipText: { color: C.text, fontSize: 14.5, fontWeight: '500', letterSpacing: -0.1 },
  big: { fontSize: 52, color: C.green },
  routedTitle: { color: C.muted, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },
  itemTitle: { color: C.text, fontSize: 20, fontWeight: '600', textAlign: 'center', letterSpacing: -0.4 },
  errText: { color: C.danger, textAlign: 'center', fontSize: 14.5 },
});
