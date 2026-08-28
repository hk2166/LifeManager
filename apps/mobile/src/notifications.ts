import * as Notifications from 'expo-notifications';
import type { ItemWithSource } from './api';

// Proactive LOCAL notifications — Life OS reaches out when something's slipping,
// even when the app isn't in front of you. (No remote push / APNs needed.)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, // SDK 57: replaces shouldShowAlert
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== 'granted') {
      await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    }
  } catch {
    /* notifications are a nicety — never let setup crash the app */
  }
}

const DAY = 86_400_000;
function mostOverdueWaiting(items: ItemWithSource[]): ItemWithSource | null {
  const now = Date.now();
  const overdue = items.filter(
    (i) =>
      i.type === 'commitment' &&
      i.direction === 'owed_to_me' &&
      i.status === 'open' &&
      i.due_at &&
      Date.parse(i.due_at) < now
  );
  overdue.sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!));
  return overdue[0] ?? null;
}

// Fire once per app session for the single most-overdue "waiting on" — the app
// pinging you about something that's slipping, with a tap-through to a nudge.
const notified = new Set<string>();
export async function syncProactiveNotifications(items: ItemWithSource[]): Promise<void> {
  try {
    const target = mostOverdueWaiting(items);
    if (!target || notified.has(target.id)) return;
    notified.add(target.id);
    const who = target.counterparty_name ?? 'Someone';
    const days = Math.floor((Date.now() - Date.parse(target.due_at!)) / DAY);
    const overdue = days <= 0 ? 'due now' : `${days}d overdue`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ Still waiting on ${who}`,
        body: `${target.title} — ${overdue}. Tap to send a nudge.`,
        data: { itemId: target.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 4, repeats: false },
    });
  } catch {
    /* best-effort */
  }
}

// Tapping the notification opens a nudge draft for that item.
export function onNotificationTap(handler: (itemId: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const id = resp.notification.request.content.data?.itemId;
    if (typeof id === 'string') handler(id);
  });
  return () => sub.remove();
}
