import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { confirmMemo, speak, uploadMemo, type ItemType, type MemoResult } from './api';
import { TYPE_ICONS } from './components';
import { C, MONO } from './theme';

// Hold the mic = push-to-talk (record while held, file/answer on release).
// A quick tap (< TAP_MS) instead opens the full review sheet for longer dictation.
export type PTTState = 'idle' | 'arming' | 'recording' | 'processing' | 'result' | 'error';
const ALL_TYPES: ItemType[] = ['commitment', 'task', 'reminder', 'event', 'shopping', 'note'];
const TAP_MS = 400;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export interface PushToTalk {
  state: PTTState;
  elapsed: number;
  result: MemoResult | null;
  err: string;
  recording: boolean;
  begin: () => void;
  end: () => void;
  pickType: (t: ItemType) => void;
  dismiss: () => void;
  replay: () => void;
}

export function usePushToTalk({ speakEnabled, onTap }: { speakEnabled: boolean; onTap: () => void }): PushToTalk {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<PTTState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<MemoResult | null>(null);
  const [err, setErr] = useState('');
  const holdStart = useRef(0);
  const isRecording = useRef(false);
  const releasedAsTap = useRef(false);

  useEffect(() => {
    if (state !== 'recording') return;
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  const autoDismiss = (ms: number) =>
    setTimeout(() => setState((s) => (s === 'result' ? 'idle' : s)), ms);

  const begin = useCallback(() => {
    holdStart.current = Date.now();
    releasedAsTap.current = false;
    setErr('');
    setResult(null);
    setElapsed(0);
    setState('arming');
    (async () => {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErr('Microphone access is off — enable it in Settings to talk.');
        setState('error');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      // finger already lifted while we were arming: it was a tap, not a hold
      if (releasedAsTap.current) {
        setState('idle');
        onTap();
        return;
      }
      recorder.record();
      isRecording.current = true;
      setState('recording');
    })().catch((e) => {
      setErr(String(e));
      setState('error');
    });
  }, [recorder, onTap]);

  const end = useCallback(() => {
    const held = Date.now() - holdStart.current;
    if (held < TAP_MS) {
      releasedAsTap.current = true;
      if (isRecording.current) {
        isRecording.current = false;
        recorder.stop().catch(() => {});
        setState('idle');
        onTap();
      }
      return; // if still arming, begin() will open the sheet when it resolves
    }
    if (!isRecording.current) return;
    isRecording.current = false;
    setState('processing');
    (async () => {
      await recorder.stop();
      if (!recorder.uri) throw new Error('no recording produced');
      const r = await uploadMemo(recorder.uri);
      setResult(r);
      setState('result');
      if (speakEnabled) {
        if (r.mode === 'answer' && r.answer) speak(r.answer.answer);
        else if (r.item) speak(`Added to your ${r.item.type}s. ${r.item.title}.`);
      }
      if (r.mode !== 'answer' && !r.needs_confirmation) autoDismiss(4200);
    })().catch((e) => {
      setErr(String(e));
      setState('error');
    });
  }, [recorder, speakEnabled, onTap]);

  const pickType = useCallback(
    (t: ItemType) => {
      if (!result) return;
      setState('processing');
      confirmMemo(result.memo.id, t)
        .then((r) => {
          setResult(r);
          setState('result');
          if (speakEnabled && r.item) speak(`Filed as ${r.item.type}.`);
          autoDismiss(3500);
        })
        .catch((e) => {
          setErr(String(e));
          setState('error');
        });
    },
    [result, speakEnabled]
  );

  const dismiss = useCallback(() => {
    setState('idle');
    setResult(null);
    setErr('');
  }, []);

  const replay = useCallback(() => {
    if (!result) return;
    if (result.mode === 'answer' && result.answer) speak(result.answer.answer);
    else if (result.item) speak(result.item.title);
  }, [result]);

  return { state, elapsed, result, err, recording: state === 'recording', begin, end, pickType, dismiss, replay };
}

// ---- The top status/result surface (the "status bar") ----
export function CapturePanel({ ptt, topOffset = 8 }: { ptt: PushToTalk; topOffset?: number }) {
  const { state, elapsed, result, err } = ptt;
  const visible = state !== 'idle';
  const slide = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(slide, { toValue: visible ? 1 : 0, useNativeDriver: true, bounciness: 7, speed: 16 }).start();
  }, [visible, slide]);

  useEffect(() => {
    if (state !== 'recording' && state !== 'arming') return;
    let anim: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      anim.start();
    });
    return () => anim?.stop();
  }, [state, pulse]);

  if (!visible && state === 'idle') return null;

  const answer = result?.mode === 'answer' ? result.answer : null;
  const confirm = state === 'result' && result?.needs_confirmation;
  const filed = state === 'result' && result?.item && !result.needs_confirmation && result.mode !== 'answer';

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        s.wrap,
        {
          top: topOffset,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        },
      ]}
    >
      <View style={s.card}>
        {(state === 'arming' || state === 'recording') && (
          <View style={s.row}>
            <Animated.View style={[s.recDot, { opacity: pulse }]} />
            <Text style={s.recTimer}>{fmt(elapsed)}</Text>
            <Text style={s.recHint}>{state === 'arming' ? 'Getting the mic…' : 'Listening — release to send'}</Text>
          </View>
        )}

        {state === 'processing' && (
          <View style={s.row}>
            <ActivityIndicator color={C.accent} />
            <Text style={s.hint}>Thinking…</Text>
          </View>
        )}

        {answer && (
          <View style={s.answerWrap}>
            <Text style={s.you}>“{result?.memo.transcript}”</Text>
            <Text style={s.answer}>{answer.answer}</Text>
            <View style={s.answerFoot}>
              <Text style={s.sources}>
                {answer.confident ? `grounded in ${answer.sources.length} email${answer.sources.length === 1 ? '' : 's'}` : 'no direct source'}
              </Text>
              <View style={s.actions}>
                <Pressable onPress={ptt.replay} hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed && s.dim]}>
                  <Text style={s.iconTxt}>▶</Text>
                </Pressable>
                <Pressable onPress={ptt.dismiss} hitSlop={8} style={({ pressed }) => pressed && s.dim}>
                  <Text style={s.done}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {confirm && result && (
          <View style={s.answerWrap}>
            <Text style={s.you}>“{result.memo.transcript}”</Text>
            <Text style={s.hint}>Not sure — file this as?</Text>
            <View style={s.chips}>
              {[result.memo.suggested_type, ...ALL_TYPES.filter((t) => t !== result.memo.suggested_type)]
                .filter((t): t is ItemType => Boolean(t))
                .map((t, i) => (
                  <Pressable
                    key={t}
                    onPress={() => ptt.pickType(t)}
                    style={({ pressed }) => [s.chip, i === 0 && s.chipTop, pressed && s.dim]}
                  >
                    <Text style={[s.chipTxt, i === 0 && s.chipTopTxt]}>
                      {TYPE_ICONS[t]} {t}
                    </Text>
                  </Pressable>
                ))}
            </View>
            <Pressable onPress={ptt.dismiss} hitSlop={8} style={({ pressed }) => [s.discardBtn, pressed && s.dim]}>
              <Text style={s.discard}>Discard</Text>
            </Pressable>
          </View>
        )}

        {filed && result?.item && (
          <View style={s.row}>
            <Text style={s.check}>✓</Text>
            <View style={s.filedMain}>
              <Text style={s.filedKicker}>Added to {result.item.type}s</Text>
              <Text style={s.filedTitle} numberOfLines={2}>
                {result.item.title}
              </Text>
            </View>
            <Pressable onPress={ptt.replay} hitSlop={8} style={({ pressed }) => [s.iconBtn, pressed && s.dim]}>
              <Text style={s.iconTxt}>▶</Text>
            </Pressable>
          </View>
        )}

        {state === 'error' && (
          <View style={s.row}>
            <Text style={s.errTxt}>{err}</Text>
            <Pressable onPress={ptt.dismiss} hitSlop={8} style={({ pressed }) => pressed && s.dim}>
              <Text style={s.done}>Close</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, top: 4, zIndex: 50 },
  card: {
    backgroundColor: C.panel2,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.rec },
  recTimer: { color: C.text, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'], fontFamily: MONO },
  recHint: { color: C.muted, fontSize: 14, flex: 1, letterSpacing: -0.1 },
  hint: { color: C.muted, fontSize: 14.5, letterSpacing: -0.1 },
  you: { color: C.muted, fontSize: 14, fontStyle: 'italic', letterSpacing: -0.2, lineHeight: 20 },
  answerWrap: { gap: 9 },
  answer: { color: C.text, fontSize: 16, lineHeight: 23, letterSpacing: -0.3, fontWeight: '500' },
  answerFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sources: { color: C.faint, fontSize: 11, letterSpacing: 0.2, fontFamily: MONO },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 11, color: C.text, marginLeft: 1 },
  done: { color: C.accent, fontSize: 15.5, fontWeight: '600', letterSpacing: -0.2 },
  dim: { opacity: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: { backgroundColor: C.fill, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  chipTop: { backgroundColor: C.accent },
  chipTxt: { color: C.text, fontSize: 13.5, fontWeight: '500', letterSpacing: -0.1 },
  chipTopTxt: { color: C.onAccent },
  discardBtn: { alignSelf: 'flex-start', paddingTop: 2 },
  discard: { color: C.muted, fontSize: 13.5, fontWeight: '500', letterSpacing: -0.1 },
  check: { color: C.green, fontSize: 24, fontWeight: '700' },
  filedMain: { flex: 1, gap: 1 },
  filedKicker: { color: C.muted, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },
  filedTitle: { color: C.text, fontSize: 15.5, fontWeight: '600', letterSpacing: -0.3 },
  errTxt: { color: C.danger, fontSize: 14, flex: 1, letterSpacing: -0.1 },
});
