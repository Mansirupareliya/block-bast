import { Platform } from 'react-native';
import { STORAGE_KEYS, loadJSON, saveJSON } from './storage';
import { GAMES } from './games';

// Daily reminder: one local notification every morning, at most once a day,
// telling the player which level they've reached in the game they played
// last ("You reached Level 12 in Light Path"). Beating a level doesn't
// notify straight away — it just updates what tomorrow morning's reminder
// says. Local notifications only — no server or push token needed. Same
// defensive dynamic-require as storage.js: a dev client built before
// expo-notifications was added just won't show notifications instead of
// crashing.
let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (error) {
  console.warn('expo-notifications could not be loaded. Notifications are disabled.', error);
}

const CHANNEL_ID = 'level-progress';
const REMINDER_ID = 'daily-level-reminder'; // reusing it replaces the old one
const REMINDER_HOUR = 9; // 9:00 in the morning, phone's local time
const REMINDER_MINUTE = 0;

let enabled = true;
let progress = null; // { gameId, level } of the last level reached
const listeners = new Set();

const ready = Promise.all([
  loadJSON(STORAGE_KEYS.NOTIFICATIONS_ENABLED, true),
  loadJSON(STORAGE_KEYS.REMINDER_PROGRESS, null),
]).then(([savedEnabled, savedProgress]) => {
  enabled = savedEnabled;
  progress = savedProgress;
  listeners.forEach((fn) => fn(enabled));
});

// Call once on app start. Shows notifications while the app is open too
// (without a handler they're dropped in the foreground), creates the Android
// channel, then asks for permission — on Android 13+ the prompt only appears
// once a channel exists, so the order matters. Finally makes sure the daily
// reminder is scheduled (or cleared if notifications are off).
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
        name: 'Daily reminder',
        description: 'One reminder each morning about your level progress',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    await ready;
    if (enabled) await ensurePermission();
    await scheduleReminder();
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

// (Re)schedules the single repeating morning reminder with the latest
// progress. Only one ever exists, so at most one notification a day.
async function scheduleReminder() {
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  if (!enabled) return;
  const game = progress && GAMES.find((g) => g.id === progress.gameId);
  const content = game
    ? {
      title: `🎮 Level ${progress.level} is waiting!`,
      body: `You reached Level ${progress.level} in ${game.name}. Come back and keep going!`,
      data: { gameId: game.id, level: progress.level },
    }
    : {
      title: '🎮 Time for a quick puzzle!',
      body: 'Your games are waiting. Come back and play!',
      data: {},
    };
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
}

// `level` is the newly unlocked level. Doesn't notify now; it updates what
// the next morning reminder says. Fire-and-forget, like saveNumber.
export function notifyLevelReached(gameId, level) {
  progress = { gameId, level };
  saveJSON(STORAGE_KEYS.REMINDER_PROGRESS, progress);
  scheduleReminder().catch((error) => console.log('Notification error:', error));
}

// Tapping the reminder calls `fn(gameId)` so the app can open that game.
// Returns an unsubscribe function.
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
  if (!Notifications) return;
  if (on) ensurePermission().catch(() => {});
  scheduleReminder().catch(() => {});
}

export function subscribeNotifications(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
