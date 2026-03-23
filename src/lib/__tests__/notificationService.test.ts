/**
 * Tests for Notification Service (expo-notifications + AsyncStorage)
 * @file src/lib/__tests__/notificationService.test.ts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock expo-notifications
const mockNotifications = {
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
};
jest.mock('expo-notifications', () => mockNotifications);

import {
  getReminderPreferences,
  setReminderEnabled,
  setReminderTime,
  initializeNotifications,
} from '../notificationService';

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.clear as jest.Mock)();
  });

  // -----------------------------------------------------------------------
  // getReminderPreferences
  // -----------------------------------------------------------------------

  describe('getReminderPreferences', () => {
    it('should return defaults when nothing stored', async () => {
      const prefs = await getReminderPreferences();
      expect(prefs).toEqual({ enabled: false, hour: 8, minute: 0 });
    });

    it('should return stored values', async () => {
      await AsyncStorage.setItem('@dreamz_reminder_enabled', 'true');
      await AsyncStorage.setItem('@dreamz_reminder_hour', '7');
      await AsyncStorage.setItem('@dreamz_reminder_minute', '30');

      const prefs = await getReminderPreferences();
      expect(prefs).toEqual({ enabled: true, hour: 7, minute: 30 });
    });
  });

  // -----------------------------------------------------------------------
  // setReminderEnabled
  // -----------------------------------------------------------------------

  describe('setReminderEnabled', () => {
    it('should schedule notification when enabled and permission granted', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      mockNotifications.scheduleNotificationAsync.mockResolvedValueOnce('notif-123');

      const result = await setReminderEnabled(true);

      expect(result.success).toBe(true);
      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({ type: 'daily', hour: 8, minute: 0 }),
        })
      );
      expect(await AsyncStorage.getItem('@dreamz_reminder_enabled')).toBe('true');
    });

    it('should request permission when not yet granted', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
      mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      mockNotifications.scheduleNotificationAsync.mockResolvedValueOnce('notif-123');

      const result = await setReminderEnabled(true);

      expect(result.success).toBe(true);
      expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should return permissionDenied when user denies', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
      mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      const result = await setReminderEnabled(true);

      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
      expect(await AsyncStorage.getItem('@dreamz_reminder_enabled')).toBe('false');
    });

    it('should cancel notification and disable when set to false', async () => {
      // Pre-set a notification ID
      await AsyncStorage.setItem('@dreamz_reminder_notification_id', 'notif-old');

      const result = await setReminderEnabled(false);

      expect(result.success).toBe(true);
      expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-old');
      expect(await AsyncStorage.getItem('@dreamz_reminder_enabled')).toBe('false');
    });
  });

  // -----------------------------------------------------------------------
  // setReminderTime
  // -----------------------------------------------------------------------

  describe('setReminderTime', () => {
    it('should store new time and reschedule if enabled', async () => {
      await AsyncStorage.setItem('@dreamz_reminder_enabled', 'true');
      mockNotifications.scheduleNotificationAsync.mockResolvedValueOnce('notif-new');

      await setReminderTime(9, 15);

      expect(await AsyncStorage.getItem('@dreamz_reminder_hour')).toBe('9');
      expect(await AsyncStorage.getItem('@dreamz_reminder_minute')).toBe('15');
      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({ hour: 9, minute: 15 }),
        })
      );
    });

    it('should store new time but not schedule if disabled', async () => {
      await AsyncStorage.setItem('@dreamz_reminder_enabled', 'false');

      await setReminderTime(6, 0);

      expect(await AsyncStorage.getItem('@dreamz_reminder_hour')).toBe('6');
      expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // initializeNotifications
  // -----------------------------------------------------------------------

  describe('initializeNotifications', () => {
    it('should opt in on first launch when permission granted', async () => {
      // No stored value = first launch
      mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      mockNotifications.scheduleNotificationAsync.mockResolvedValueOnce('notif-init');

      await initializeNotifications();

      expect(mockNotifications.setNotificationHandler).toHaveBeenCalled();
      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalled();
      expect(await AsyncStorage.getItem('@dreamz_reminder_enabled')).toBe('true');
    });

    it('should not opt in on first launch when permission denied', async () => {
      mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      await initializeNotifications();

      expect(await AsyncStorage.getItem('@dreamz_reminder_enabled')).toBe('false');
      expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should disable reminders if user revoked OS permission after enabling', async () => {
      await AsyncStorage.setItem('@dreamz_reminder_enabled', 'true');
      await AsyncStorage.setItem('@dreamz_reminder_notification_id', 'notif-old');
      mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

      await initializeNotifications();

      expect(await AsyncStorage.getItem('@dreamz_reminder_enabled')).toBe('false');
      expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-old');
    });

    it('should re-schedule if previously enabled and permission still granted', async () => {
      await AsyncStorage.setItem('@dreamz_reminder_enabled', 'true');
      await AsyncStorage.setItem('@dreamz_reminder_hour', '7');
      await AsyncStorage.setItem('@dreamz_reminder_minute', '30');
      mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
      mockNotifications.scheduleNotificationAsync.mockResolvedValueOnce('notif-re');

      await initializeNotifications();

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({ hour: 7, minute: 30 }),
        })
      );
    });
  });
});
