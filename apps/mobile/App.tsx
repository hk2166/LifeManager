import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { usePoll, type ItemWithSource } from './src/api';
import { MemoDetail } from './src/MemoDetail';
import { MemoFlow } from './src/MemoFlow';
import { ItemsScreen, TodayScreen } from './src/screens';
import { C } from './src/theme';

export default function App() {
  const [tab, setTab] = useState<'today' | 'items'>('today');
  const [memoOpen, setMemoOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, error } = usePoll<ItemWithSource[]>('/api/items');
  const items = data ?? [];

  return (
    <SafeAreaProvider>
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Text style={s.brand}>Life OS</Text>
        {error && <Text style={s.offline}>offline</Text>}
      </View>

      {tab === 'today' ? (
        <TodayScreen items={items} onOpenMemoItem={setDetailId} />
      ) : (
        <ItemsScreen items={items} onOpenMemoItem={setDetailId} />
      )}

      <View style={s.tabbar}>
        <Pressable style={s.tab} onPress={() => setTab('today')}>
          <Text style={[s.tabText, tab === 'today' && s.tabActive]}>Today</Text>
        </Pressable>
        <Pressable style={s.mic} onPress={() => setMemoOpen(true)}>
          <Text style={s.micIcon}>🎤</Text>
        </Pressable>
        <Pressable style={s.tab} onPress={() => setTab('items')}>
          <Text style={[s.tabText, tab === 'items' && s.tabActive]}>Items</Text>
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
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  brand: { color: C.text, fontSize: 19, fontWeight: '700', letterSpacing: 0.3 },
  offline: { color: C.danger, fontSize: 12.5 },
  tabbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.panel,
    borderTopColor: C.border,
    borderTopWidth: 1,
    paddingBottom: 26,
    paddingTop: 10,
  },
  tab: { padding: 10, width: 110, alignItems: 'center' },
  tabText: { color: C.muted, fontSize: 14.5 },
  tabActive: { color: C.text, fontWeight: '600' },
  // the product thesis in one control: capture is always one tap away
  mic: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  micIcon: { fontSize: 26 },
});
