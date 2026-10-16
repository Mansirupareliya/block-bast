import { Platform } from 'react-native';
import { STORAGE_KEYS, loadJSON, saveJSON } from './storage';
import { GAMES } from './games';

// "Level unlocked" notifications. These are local notifications fired the
// moment a level is beaten — no server or push token needed. Same defensive
// dynamic-require as storage.js: a dev client built before expo-notifications
// was added just won't show notifications instead of crashing.
let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (error) {
  console.warn('expo-notifications could not be loaded. Notifications are disabled.', error);
}

const CHANNEL_ID = 'level-progress';

let enabled = true;
const listeners = new Set();

loadJSON(STORAGE_KEYS.NOTIFICATIONS_ENABLED, true).then((saved) => {
  enabled = saved;
  listeners.forEach((fn) => fn(enabled));
});

// Call once on app start. Shows notifications while the app is open too
// (without a handler they're dropped in the foreground), creates the Android
// channel, then asks for permission — on Android 13+ the prompt only appears
// once a channel exists, so the order matters.
export async function initNotifications() {
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        // Android won't drop the banner down without sound.
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Level progress',
        description: 'When you unlock a new level',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    if (enabled) await ensurePermission();
  } catch (error) {
    console.log('Notification init error:', error);
  }
}

async function ensurePermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// `level` is the newly unlocked level. Fire-and-forget, like saveNumber.
export function notifyLevelReached(gameId, level) {
  if (!enabled || !Notifications) return;
  const name = GAMES.find((g) => g.id === gameId)?.name ?? 'the game';
  Notifications.scheduleNotificationAsync({
    content: {
      title: `🎉 Level ${level} unlocked!`,
      body: `You reached Level ${level} in ${name}. Keep going!`,
      data: { gameId, level },
    },
    // Android: show now, on our channel. iOS: null = show now.
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
  }).catch((error) => console.log('Notification error:', error));
}

// Tapping a level notification calls `fn(gameId)` so the app can open that
// game. Returns an unsubscribe function.
export function subscribeNotificationTaps(fn) {
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const gameId = response.notification.request.content.data?.gameId;
    if (gameId) fn(gameId);
  });
  return () => sub.remove();
}

export function isNotificationsEnabled() {
  return enabled;
}

export function setNotificationsEnabled(on) {
  enabled = on;
  saveJSON(STORAGE_KEYS.NOTIFICATIONS_ENABLED, on);
  listeners.forEach((fn) => fn(on));
  if (on && Notifications) ensurePermission().catch(() => {});
}

export function subscribeNotifications(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
