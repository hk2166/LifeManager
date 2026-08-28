import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { bootstrapAuth, logout, stopSpeaking, useAuth, usePoll, type ItemWithSource } from './src/api';
import { AuthScreen } from './src/AuthScreen';
import { MemoDetail } from './src/MemoDetail';
import { MemoFlow } from './src/MemoFlow';
import { NudgeSheet } from './src/NudgeSheet';
import { onNotificationTap, setupNotifications, syncProactiveNotifications } from './src/notifications';
import { CapturePanel, usePushToTalk } from './src/PushToTalk';
import { ItemsScreen, TodayScreen } from './src/screens';
import { C, MONO } from './src/theme';

export default function App() {
  const { token, loaded } = useAuth();
  useEffect(() => {
    bootstrapAuth();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {!loaded ? (
        <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : !token ? (
        <AuthScreen />
      ) : (
        <Home />
      )}
    </SafeAreaProvider>
  );
}

function Home() {
  const [tab, setTab] = useState<'today' | 'items'>('today');
  const [memoOpen, setMemoOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [nudgeItem, setNudgeItem] = useState<ItemWithSource | null>(null);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const { data, error } = usePoll<ItemWithSource[]>('/api/items');
  const items = data ?? [];

  useEffect(() => {
    AsyncStorage.getItem('lifeos_speak').then((v) => {
      if (v != null) setSpeakEnabled(v === '1');
    });
  }, []);
  const toggleSpeak = () =>
    setSpeakEnabled((on) => {
      const next = !on;
      AsyncStorage.setItem('lifeos_speak', next ? '1' : '0').catch(() => {});
      if (!next) stopSpeaking();
      return next;
    });

  const ptt = usePushToTalk({ speakEnabled, onTap: () => setMemoOpen(true) });
  const insets = useSafeAreaInsets();

  // Proactive notifications: ask once, ping about the most-overdue "waiting on",
  // and open its nudge draft when the notification is tapped.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    setupNotifications();
    return onNotificationTap((id) => {
      const it = itemsRef.current.find((i) => i.id === id);
      if (it) setNudgeItem(it);
    });
  }, []);
  useEffect(() => {
    if (items.length) syncProactiveNotifications(items);
  }, [items]);

  const micScale = useRef(new Animated.Value(1)).current;
  const springMic = (toValue: number) =>
    Animated.spring(micScale, { toValue, useNativeDriver: true, bounciness: toValue < 1 ? 3 : 9, speed: 44 }).start();

  return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <View style={s.brandRow}>
            <View style={s.dot} />
            <Text style={s.brand}>Life OS</Text>
          </View>
          <View style={s.headerRight}>
            {error && <Text style={s.offline}>offline</Text>}
            <Pressable onPress={toggleSpeak} hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.5 }}>
              <Text style={[s.speakToggle, !speakEnabled && s.speakToggleOff]}>VOICE</Text>
            </Pressable>
            <Pressable onPress={logout} hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.5 }}>
              <Text style={s.signout}>Sign out</Text>
            </Pressable>
          </View>
        </View>

        {tab === 'today' ? (
          <TodayScreen items={items} onOpenMemoItem={setDetailId} onNudge={setNudgeItem} />
        ) : (
          <ItemsScreen items={items} onOpenMemoItem={setDetailId} onNudge={setNudgeItem} />
        )}

        <CapturePanel ptt={ptt} topOffset={insets.top + 44} />

        <BlurView intensity={80} tint="systemChromeMaterialDark" style={s.tabbar}>
          <Pressable style={({ pressed }) => [s.tab, pressed && s.tabPressed]} onPress={() => setTab('today')}>
            <Text style={[s.tabText, tab === 'today' && s.tabActive]}>Today</Text>
          </Pressable>
          <View style={s.micSlot} />
          <Pressable style={({ pressed }) => [s.tab, pressed && s.tabPressed]} onPress={() => setTab('items')}>
            <Text style={[s.tabText, tab === 'items' && s.tabActive]}>Items</Text>
          </Pressable>
        </BlurView>

        {/* Floating push-to-talk button — a sibling of the tab bar so its full
            circle is touchable (a child raised out of the bar gets its overflow
            clipped and the top half stops receiving touches). Hold = talk,
            quick tap = full capture sheet. box-none lets Today/Items stay tappable. */}
        <View style={s.micWrap} pointerEvents="box-none">
          <Pressable
            onPressIn={() => {
              springMic(0.9);
              ptt.begin();
            }}
            onPressOut={() => {
              springMic(1);
              ptt.end();
            }}
            hitSlop={16}
            accessibilityLabel="Hold to talk. Tap for the full capture sheet."
          >
            <Animated.View style={[s.mic, ptt.recording && s.micRec, { transform: [{ scale: micScale }] }]}>
              <View style={[s.micDot, ptt.recording && s.micDotRec]} />
            </Animated.View>
          </Pressable>
        </View>

        <Modal
          visible={memoOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setMemoOpen(false)}
        >
          <MemoFlow onDone={() => setMemoOpen(false)} />
        </Modal>

        <Modal
          visible={!!detailId}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setDetailId(null)}
        >
          {detailId && <MemoDetail memoId={detailId} onClose={() => setDetailId(null)} />}
        </Modal>

        <Modal
          visible={!!nudgeItem}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setNudgeItem(null)}
        >
          {nudgeItem && <NudgeSheet item={nudgeItem} onClose={() => setNudgeItem(null)} />}
        </Modal>
      </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.accent },
  brand: { color: C.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offline: { color: C.danger, fontSize: 12.5, fontWeight: '600' },
  speakToggle: { color: C.text, fontSize: 11, fontFamily: MONO, letterSpacing: 1.5, fontWeight: '600' },
  speakToggleOff: { color: C.faint, textDecorationLine: 'line-through' },
  signout: { color: C.muted, fontSize: 14.5, fontWeight: '500' },
  tabbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopColor: C.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 30,
    paddingTop: 12,
    overflow: 'hidden',
  },
  tab: { paddingVertical: 8, paddingHorizontal: 24, borderRadius: 12, width: 118, alignItems: 'center' },
  tabPressed: { opacity: 0.55 },
  tabText: { color: C.muted, fontSize: 15, letterSpacing: -0.2 },
  tabActive: { color: C.text, fontWeight: '600' },
  micSlot: { width: 62 }, // reserves the center gap the floating mic sits over
  micWrap: { position: 'absolute', left: 0, right: 0, bottom: 66, alignItems: 'center', zIndex: 20 },
  // capture is always one hold away — the product thesis in one control
  mic: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffffff',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  micRec: { backgroundColor: C.rec, shadowColor: C.rec, shadowOpacity: 0.55 },
  micDot: { width: 15, height: 15, borderRadius: 8, backgroundColor: C.onAccent },
  micDotRec: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#ffffff' },
});
