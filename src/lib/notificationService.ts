import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  ENABLED: '@dreamz_reminder_enabled',
  HOUR: '@dreamz_reminder_hour',
  MINUTE: '@dreamz_reminder_minute',
  NOTIFICATION_ID: '@dreamz_reminder_notification_id',
};

export interface ReminderPreferences {
  enabled: boolean;
  hour: number;
  minute: number;
}

const MYSTICAL_MESSAGES = [
  'The veil is thinnest at dawn. What did you see beyond it?',
  'Your dreams left breadcrumbs last night. Shall we follow them?',
  'The night kept something for you. Come collect it.',
  'Something stirred in your sleep. Let\'s find out what.',
  'Your grimoire awaits a new page. What visions came to you?',
  'The night whispered something. Do you remember?',
  'Dreams fade like morning mist. Capture yours before they vanish.',
  'A symbol appeared in your sleep. Let\'s decode it together.',
  'Something rearranged itself last night while you slept. Take a look.',
  'Your subconscious left you a letter. Ready to read it?',
  'Between midnight and dawn, you traveled far. Where did you go?',
  'The dream realm had a message for you. Don\'t let it slip away.',
];

function getRandomMessage(): string {
  return MYSTICAL_MESSAGES[Math.floor(Math.random() * MYSTICAL_MESSAGES.length)];
}

export async function getReminderPreferences(): Promise<ReminderPreferences> {
  const [enabled, hour, minute] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.ENABLED),
    AsyncStorage.getItem(STORAGE_KEYS.HOUR),
    AsyncStorage.getItem(STORAGE_KEYS.MINUTE),
  ]);

  return {
    enabled: enabled === 'true',
    hour: hour !== null ? parseInt(hour, 10) : 8,
    minute: minute !== null ? parseInt(minute, 10) : 0,
  };
}

async function cancelExistingReminder(): Promise<void> {
  const existingId = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ID);
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId);
    await AsyncStorage.removeItem(STORAGE_KEYS.NOTIFICATION_ID);
  }
}

async function scheduleReminder(hour: number, minute: number): Promise<void> {
  await cancelExistingReminder();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Dreamz',
      body: getRandomMessage(),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_ID, id);
}

export async function setReminderEnabled(
  enabled: boolean
): Promise<{ success: boolean; permissionDenied?: boolean }> {
  if (enabled) {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      await AsyncStorage.setItem(STORAGE_KEYS.ENABLED, 'false');
      return { success: false, permissionDenied: true };
    }

    const prefs = await getReminderPreferences();
    await scheduleReminder(prefs.hour, prefs.minute);
    await AsyncStorage.setItem(STORAGE_KEYS.ENABLED, 'true');
    return { success: true };
  } else {
    await cancelExistingReminder();
    await AsyncStorage.setItem(STORAGE_KEYS.ENABLED, 'false');
    return { success: true };
  }
}

export async function setReminderTime(hour: number, minute: number): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.HOUR, String(hour));
  await AsyncStorage.setItem(STORAGE_KEYS.MINUTE, String(minute));

  const prefs = await getReminderPreferences();
  if (prefs.enabled) {
    await scheduleReminder(hour, minute);
  }
}

export async function initializeNotifications(): Promise<void> {
  // Set foreground notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Check if this is the first launch (no preference stored yet)
  const storedEnabled = await AsyncStorage.getItem(STORAGE_KEYS.ENABLED);
  if (storedEnabled === null) {
    // First launch — opt users in by default (8:00 AM)
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      await scheduleReminder(8, 0);
      await AsyncStorage.setItem(STORAGE_KEYS.ENABLED, 'true');
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.ENABLED, 'false');
    }
    return;
  }

  // Re-validate schedule if reminders were previously enabled
  const prefs = await getReminderPreferences();
  if (prefs.enabled) {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      // User revoked OS permission — sync state
      await AsyncStorage.setItem(STORAGE_KEYS.ENABLED, 'false');
      await cancelExistingReminder();
    } else {
      // Re-schedule to ensure it's still active
      await scheduleReminder(prefs.hour, prefs.minute);
    }
  }
}
