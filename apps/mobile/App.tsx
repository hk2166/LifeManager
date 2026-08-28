import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { bootstrapAuth, logout, useAuth, usePoll, type ItemWithSource } from './src/api';
import { AuthScreen } from './src/AuthScreen';
import { MemoDetail } from './src/MemoDetail';
import { MemoFlow } from './src/MemoFlow';
import { ItemsScreen, TodayScreen } from './src/screens';
import { C } from './src/theme';

export default function App() {
  const { token, loaded } = useAuth();
  useEffect(() => {
    bootstrapAuth();
  }, []);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }
  if (!token) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthScreen />
      </SafeAreaProvider>
    );
  }
  return <Home />;
}

function Home() {
  const [tab, setTab] = useState<'today' | 'items'>('today');
  const [memoOpen, setMemoOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, error } = usePoll<ItemWithSource[]>('/api/items');
  const items = data ?? [];

  const micScale = useRef(new Animated.Value(1)).current;
  const springMic = (toValue: number) =>
    Animated.spring(micScale, { toValue, useNativeDriver: true, bounciness: toValue < 1 ? 3 : 9, speed: 44 }).start();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe} edges={['top']}>
        <StatusBar style="light" />
        <View style={s.header}>
          <View style={s.brandRow}>
            <View style={s.dot} />
            <Text style={s.brand}>Life OS</Text>
          </View>
          <View style={s.headerRight}>
            {error && <Text style={s.offline}>offline</Text>}
            <Pressable onPress={logout} hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.5 }}>
              <Text style={s.signout}>Sign out</Text>
            </Pressable>
          </View>
        </View>

        {tab === 'today' ? (
          <TodayScreen items={items} onOpenMemoItem={setDetailId} />
        ) : (
          <ItemsScreen items={items} onOpenMemoItem={setDetailId} />
        )}

        <BlurView intensity={80} tint="systemChromeMaterialDark" style={s.tabbar}>
          <Pressable style={({ pressed }) => [s.tab, pressed && s.tabPressed]} onPress={() => setTab('today')}>
            <Text style={[s.tabText, tab === 'today' && s.tabActive]}>Today</Text>
          </Pressable>
          <Pressable
            onPressIn={() => springMic(0.86)}
            onPressOut={() => springMic(1)}
            onPress={() => setMemoOpen(true)}
            hitSlop={12}
          >
            <Animated.View style={[s.mic, { transform: [{ scale: micScale }] }]}>
              <Text style={s.micIcon}>🎤</Text>
            </Animated.View>
          </Pressable>
          <Pressable style={({ pressed }) => [s.tab, pressed && s.tabPressed]} onPress={() => setTab('items')}>
            <Text style={[s.tabText, tab === 'items' && s.tabActive]}>Items</Text>
          </Pressable>
        </BlurView>

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
      </SafeAreaView>
    </SafeAreaProvider>
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
  // capture is always one tap away — the product thesis in one control
  mic: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -32,
    shadowColor: C.accent,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  micIcon: { fontSize: 25 },
});
