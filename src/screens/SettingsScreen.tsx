import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Share,
  Modal,
  FlatList,
  ActivityIndicator,
  Linking,
  Platform,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getProfile, updateZodiacSign, updateProfile } from '../lib/profileService';
import { exportUserDreams, deleteUserAccount } from '../lib/accountService';
import { fetchUserDreams, deleteDream } from '../lib/dreamService';
import { checkPremiumAccess } from '../lib/purchaseService';
import * as Notifications from 'expo-notifications';
import { getReminderPreferences, setReminderEnabled, setReminderTime } from '../lib/notificationService';
import { clearDraft } from '../lib/draftService';
import { ZODIAC_SIGNS } from '../types';
import type { Dream } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [zodiacSign, setZodiacSign] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'premium'>('free');
  const [showZodiacPicker, setShowZodiacPicker] = useState(false);
  const [showDreamPicker, setShowDreamPicker] = useState(false);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loadingDreams, setLoadingDreams] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(8);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Re-fetch profile every time screen gains focus (fixes stale tier after upgrade)
  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  async function fetchUserData() {
    const { data: { user } } = await supabase.auth.getUser();
    setUserEmail(user?.email || null);

    const profile = await getProfile();
    if (profile) {
      if (profile.display_name) setDisplayName(profile.display_name);
      if (profile.zodiac_sign) setZodiacSign(profile.zodiac_sign);

      const isPremium = profile.subscription_tier === 'premium' || await checkPremiumAccess();
      setSubscriptionTier(isPremium ? 'premium' : 'free');
    }

    const reminderPrefs = await getReminderPreferences();
    setRemindersEnabled(reminderPrefs.enabled);
    setReminderHour(reminderPrefs.hour);
    setReminderMinute(reminderPrefs.minute);
  }

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    const success = await updateProfile({ display_name: trimmed || '' });
    if (success) {
      setDisplayName(trimmed);
    }
    setEditingName(false);
  }

  async function handleZodiacSelect(sign: string) {
    const success = await updateZodiacSign(sign);
    if (success) {
      setZodiacSign(sign);
    }
    setShowZodiacPicker(false);
  }

  async function handleOpenDreamPicker() {
    setShowDreamPicker(true);
    setLoadingDreams(true);

    const result = await fetchUserDreams();
    if (result.success) {
      setDreams(result.dreams);
    } else {
      Alert.alert('Error', result.error);
    }
    setLoadingDreams(false);
  }

  function handleDeleteDreamPress(dream: Dream) {
    const title = dream.reading?.title || 'this dream';
    Alert.alert(
      'Delete Dream',
      `Are you sure you want to delete "${title}"?\n\nIt can be recovered within 30 days by contacting support.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => performDreamDeletion(dream.id),
        },
      ]
    );
  }

  async function performDreamDeletion(dreamId: string) {
    const result = await deleteDream(dreamId);
    if (result.success) {
      const remaining = dreams.filter(d => d.id !== dreamId);
      setDreams(remaining);
      if (remaining.length === 0) {
        setShowDreamPicker(false);
      }
    } else {
      Alert.alert('Error', result.error);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  async function handleExportDreams() {
    try {
      setLoading(true);
      const result = await exportUserDreams();

      if (!result.success) {
        Alert.alert('Export Error', result.error);
        return;
      }

      await Share.share({
        message: JSON.stringify(result.data, null, 2),
        title: 'My Dreamz Journal Export',
      });
    } catch (error: any) {
      Alert.alert('Export Error', error.message || 'Failed to export dreams');
    } finally {
      setLoading(false);
    }
  }

  function startDeleteCountdown() {
    setDeleteCountdown(5);
    setShowDeleteWarning(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setDeleteCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function cancelDelete() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowDeleteWarning(false);
    setDeleteCountdown(5);
  }

  async function handleDeleteAccount() {
    // First quick confirmation via Alert
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your dreams. This action cannot be undone.\n\nAre you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Continue',
          style: 'destructive',
          onPress: startDeleteCountdown,
        },
      ]
    );
  }

  async function performAccountDeletion() {
    cancelDelete();
    try {
      setLoading(true);
      const result = await deleteUserAccount();

      if (!result.success) {
        Alert.alert('Deletion Error', result.error);
        return;
      }

      Alert.alert(
        'Farewell, Dreamer',
        'Your account and all dreams have been deleted. May your waking hours be filled with wonder.'
      );
      await supabase.auth.signOut();
    } catch (error: any) {
      Alert.alert('Deletion Error', error.message || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  }

  function formatTime(hour: number, minute: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  }

  const TIME_SLOTS = (() => {
    const slots: { hour: number; minute: number; label: string }[] = [];
    for (let h = 5; h <= 10; h++) {
      for (const m of [0, 30]) {
        if (h === 10 && m === 30) continue;
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h > 12 ? h - 12 : h;
        slots.push({
          hour: h,
          minute: m,
          label: `${displayH}:${m.toString().padStart(2, '0')} ${period}`,
        });
      }
    }
    return slots;
  })();

  async function handleReminderToggle(value: boolean) {
    setRemindersEnabled(value);
    const result = await setReminderEnabled(value);
    if (!result.success && result.permissionDenied) {
      setRemindersEnabled(false);
      Alert.alert(
        'Notifications Disabled',
        'Dreamz needs notification permission to send dream reminders. You can enable it in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  }

  async function handleTimeSelect(hour: number, minute: number) {
    setReminderHour(hour);
    setReminderMinute(minute);
    setShowTimePicker(false);
    await setReminderTime(hour, minute);
  }

  async function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          onPress: async () => {
            await clearDraft();
            await Notifications.cancelAllScheduledNotificationsAsync();
            await supabase.auth.signOut();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Modal
        visible={showZodiacPicker}
        transparent
        animationType="fade"
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Your Sign</Text>
            <ScrollView style={styles.zodiacList} showsVerticalScrollIndicator={false}>
              {ZODIAC_SIGNS.map((sign) => (
                <TouchableOpacity
                  key={sign}
                  testID={`zodiac-option-${sign.toLowerCase()}`}
                  style={[
                    styles.zodiacOption,
                    zodiacSign === sign && styles.zodiacOptionSelected,
                  ]}
                  onPress={() => handleZodiacSelect(sign)}
                >
                  <Text style={[
                    styles.zodiacText,
                    zodiacSign === sign && styles.zodiacTextSelected,
                  ]}>
                    {sign}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              testID="settings-zodiac-cancel"
              style={styles.cancelButton}
              onPress={() => setShowZodiacPicker(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDreamPicker}
        transparent
        animationType="fade"
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Dream to Delete</Text>
            {loadingDreams ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#9b7fd4" />
              </View>
            ) : dreams.length === 0 ? (
              <View style={styles.emptyDreamsContainer}>
                <Text style={styles.emptyDreamsText}>No dreams to delete</Text>
                <Text style={styles.emptyDreamsSubtext}>Your grimoire is empty</Text>
              </View>
            ) : (
              <FlatList
                data={dreams}
                keyExtractor={(item) => item.id}
                style={styles.dreamList}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.dreamItem}
                    onPress={() => handleDeleteDreamPress(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete dream: ${item.reading?.title || 'Untitled Dream'}, ${formatDate(item.created_at)}`}
                  >
                    <View style={styles.dreamItemContent}>
                      <Text style={styles.dreamItemTitle}>
                        {item.reading?.title || 'Untitled Dream'}
                      </Text>
                      <Text style={styles.dreamItemDate}>
                        {formatDate(item.created_at)}
                      </Text>
                      <Text style={styles.dreamItemPreview} numberOfLines={2}>
                        {item.dream_text}
                      </Text>
                    </View>
                    <Text style={styles.dreamItemDelete}>✕</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity
              testID="settings-dream-picker-done"
              style={styles.cancelButton}
              onPress={() => setShowDreamPicker(false)}
            >
              <Text style={styles.cancelText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reminder Time</Text>
            <ScrollView style={styles.zodiacList} showsVerticalScrollIndicator={false}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={`${slot.hour}-${slot.minute}`}
                  testID={`time-option-${slot.hour}-${slot.minute}`}
                  style={[
                    styles.zodiacOption,
                    reminderHour === slot.hour && reminderMinute === slot.minute && styles.zodiacOptionSelected,
                  ]}
                  onPress={() => handleTimeSelect(slot.hour, slot.minute)}
                >
                  <Text style={[
                    styles.zodiacText,
                    reminderHour === slot.hour && reminderMinute === slot.minute && styles.zodiacTextSelected,
                  ]}>
                    {slot.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              testID="settings-time-picker-cancel"
              style={styles.cancelButton}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteWarning}
        transparent
        animationType="fade"
        accessibilityViewIsModal={true}
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteWarningModal}>
            <Text style={styles.deleteWarningIcon}>{'\u26A0\uFE0F'}</Text>
            <Text style={styles.deleteWarningTitle}>This Cannot Be Undone</Text>

            <Text style={styles.deleteWarningBody}>
              All your dreams, readings, symbols, and account data will be{' '}
              <Text style={styles.deleteWarningBold}>permanently erased</Text>.
            </Text>

            {subscriptionTier === 'premium' && (
              <View style={styles.subscriptionWarning}>
                <Text style={styles.subscriptionWarningTitle}>
                  You have an active subscription
                </Text>
                <Text style={styles.subscriptionWarningBody}>
                  Deleting your account will{' '}
                  <Text style={styles.deleteWarningBold}>not</Text>{' '}
                  cancel your {Platform.OS === 'ios' ? 'Apple' : 'Google Play'} subscription.
                  You will continue to be charged unless you cancel it first.
                </Text>
                <TouchableOpacity
                  style={styles.manageSubButton}
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      Linking.openURL('https://apps.apple.com/account/subscriptions');
                    } else {
                      Linking.openURL('https://play.google.com/store/account/subscriptions');
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel subscription first"
                >
                  <Text style={styles.manageSubButtonText}>
                    Cancel Subscription First
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              testID="settings-delete-confirm-button"
              style={[
                styles.deleteConfirmButton,
                deleteCountdown > 0 && styles.deleteConfirmButtonDisabled,
              ]}
              onPress={performAccountDeletion}
              disabled={deleteCountdown > 0}
              accessibilityRole="button"
              accessibilityLabel={
                deleteCountdown > 0
                  ? `Delete everything, available in ${deleteCountdown} seconds`
                  : 'Delete everything'
              }
            >
              <Text style={[
                styles.deleteConfirmButtonText,
                deleteCountdown > 0 && styles.deleteConfirmButtonTextDisabled,
              ]}>
                {deleteCountdown > 0
                  ? `Delete Everything (${deleteCountdown})`
                  : 'Delete Everything'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="settings-delete-cancel-button"
              style={styles.deleteWarningCancelButton}
              onPress={cancelDelete}
              accessibilityRole="button"
              accessibilityLabel="Cancel and go back"
            >
              <Text style={styles.deleteWarningCancelText}>No, Keep My Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView testID="settings-scroll-view" style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text testID="settings-title" style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{userEmail || 'Loading...'}</Text>
          </View>

          {editingName ? (
            <View style={[styles.card, styles.nameEditRow]}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Enter your name"
                placeholderTextColor="#8b7fa8"
                autoFocus
                maxLength={50}
                onSubmitEditing={handleSaveName}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={handleSaveName}>
                <Text style={styles.editText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingName(false)}>
                <Text style={styles.cancelInlineText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.card, styles.cardButton]}
              onPress={() => { setNameInput(displayName); setEditingName(true); }}
              accessibilityRole="button"
              accessibilityLabel={`Display Name: ${displayName || 'Not set'}. Tap to edit.`}
            >
              <View>
                <Text style={styles.label}>Display Name</Text>
                <Text style={styles.value}>{displayName || 'Not set'}</Text>
              </View>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            testID="settings-zodiac-edit"
            style={[styles.card, styles.cardButton]}
            onPress={() => setShowZodiacPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Zodiac Sign: ${zodiacSign || 'Not set'}. Tap to edit.`}
          >
            <View>
              <Text style={styles.label}>Zodiac Sign</Text>
              <Text style={styles.value}>
                {zodiacSign || 'Not set'}
              </Text>
            </View>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Current Plan</Text>
            <Text style={styles.value}>
              {subscriptionTier === 'premium' ? 'Premium' : 'Free'}
            </Text>
          </View>

          {subscriptionTier === 'free' ? (
            <TouchableOpacity
              testID="settings-upgrade-button"
              style={[styles.menuItem, styles.upgradeItem]}
              onPress={() => (navigation as any).navigate('Paywall', { source: 'settings' })}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Premium"
            >
              <Text style={styles.upgradeText}>Upgrade to Premium</Text>
              <Text style={styles.menuItemSubtext}>Deeper readings, dream imagery & no ads</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="settings-manage-subscription"
              style={styles.menuItem}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('https://apps.apple.com/account/subscriptions');
                } else {
                  Linking.openURL('https://play.google.com/store/account/subscriptions');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Manage Subscription"
            >
              <Text style={styles.menuItemText}>Manage Subscription</Text>
              <Text style={styles.menuItemSubtext}>Change or cancel in device settings</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reminders</Text>

          <View style={[styles.card, styles.cardButton]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemText}>Dream Reminders</Text>
              <Text style={styles.menuItemSubtext}>
                {remindersEnabled ? 'A gentle nudge each morning' : 'Never miss a dream again'}
              </Text>
            </View>
            <Switch
              testID="settings-reminder-toggle"
              value={remindersEnabled}
              onValueChange={handleReminderToggle}
              trackColor={{ false: '#3a3a5e', true: '#6b4e9e' }}
              thumbColor={remindersEnabled ? '#e0d4f7' : '#8b7fa8'}
            />
          </View>

          {remindersEnabled && (
            <TouchableOpacity
              testID="settings-reminder-time"
              style={[styles.card, styles.cardButton]}
              onPress={() => setShowTimePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`Reminder time: ${formatTime(reminderHour, reminderMinute)}. Tap to change.`}
            >
              <View>
                <Text style={styles.label}>Reminder Time</Text>
                <Text style={styles.value}>{formatTime(reminderHour, reminderMinute)}</Text>
              </View>
              <Text style={styles.editText}>Change</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Data</Text>

          <TouchableOpacity
            testID="settings-export-button"
            style={styles.menuItem}
            onPress={handleExportDreams}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Gather Your Dreams — Export all dreams as JSON"
          >
            <Text style={styles.menuItemText}>Gather Your Dreams</Text>
            <Text style={styles.menuItemSubtext}>Export all dreams as JSON</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="settings-delete-dream-button"
            style={styles.menuItem}
            onPress={handleOpenDreamPicker}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Release a Dream — Delete an individual dream"
          >
            <Text style={styles.menuItemText}>Release a Dream</Text>
            <Text style={styles.menuItemSubtext}>Delete individual dreams from your grimoire</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="settings-signout-button"
          style={styles.signOutButtonProminent}
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <LinearGradient
            colors={['#3a3a5e', '#2a2a4e']}
            style={styles.signOutGradient}
          >
            <Text style={styles.signOutProminentText}>Step Away from the Grimoire</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          testID="settings-delete-account-button"
          style={styles.deleteAccountLink}
          onPress={handleDeleteAccount}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Delete account and all data"
        >
          <Text style={styles.deleteAccountLinkText}>Close the Grimoire Forever</Text>
        </TouchableOpacity>

        <View style={styles.legalRow}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://dreamz-journal.com/privacy.html')}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.legalSeparator}>|</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
            accessibilityRole="link"
            accessibilityLabel="Terms of Use"
          >
            <Text style={styles.legalLink}>Terms of Use</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.version}>Dreamz v1.0.0</Text>
        <Text style={styles.footer}>Your dreams are private. Always.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0d4f7',
    marginTop: 20,
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8b7fa8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3a3a5e',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cardButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editText: {
    color: '#9b7fd4',
    fontSize: 14,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    color: '#e0d4f7',
    padding: 0,
  },
  cancelInlineText: {
    color: '#8b7fa8',
    fontSize: 14,
  },
  label: {
    fontSize: 12,
    color: '#8b7fa8',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#e0d4f7',
  },
  menuItem: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3a3a5e',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  menuItemText: {
    fontSize: 16,
    color: '#e0d4f7',
    marginBottom: 4,
  },
  menuItemSubtext: {
    fontSize: 13,
    color: '#8b7fa8',
  },
  upgradeItem: {
    borderColor: '#6b4e9e',
    backgroundColor: '#2d2a4e',
  },
  upgradeText: {
    fontSize: 16,
    color: '#9b7fd4',
    fontWeight: '600',
    marginBottom: 4,
  },
  signOutButtonProminent: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
  },
  signOutGradient: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a4a6e',
  },
  signOutProminentText: {
    color: '#e0d4f7',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  deleteAccountLinkText: {
    color: '#8b7fa8',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  legalLink: {
    color: '#8b7fa8',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    color: '#5a5a7a',
    fontSize: 12,
    marginHorizontal: 8,
  },
  version: {
    textAlign: 'center',
    color: '#5a5a7a',
    fontSize: 12,
    marginTop: 12,
  },
  footer: {
    textAlign: 'center',
    color: '#5a5a7a',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e0d4f7',
    textAlign: 'center',
    marginBottom: 16,
  },
  zodiacList: {
    maxHeight: 350,
  },
  zodiacOption: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  zodiacOptionSelected: {
    backgroundColor: '#3a3a6e',
    borderColor: '#9b7fd4',
  },
  zodiacText: {
    color: '#e0d4f7',
    fontSize: 16,
    textAlign: 'center',
  },
  zodiacTextSelected: {
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 12,
    padding: 12,
  },
  cancelText: {
    color: '#8b7fa8',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyDreamsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyDreamsText: {
    fontSize: 16,
    color: '#e0d4f7',
    marginBottom: 4,
  },
  emptyDreamsSubtext: {
    fontSize: 14,
    color: '#8b7fa8',
  },
  dreamList: {
    maxHeight: 350,
  },
  dreamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  dreamItemContent: {
    flex: 1,
  },
  dreamItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e0d4f7',
    marginBottom: 2,
  },
  dreamItemDate: {
    fontSize: 12,
    color: '#8b7fa8',
    marginBottom: 4,
  },
  dreamItemPreview: {
    fontSize: 13,
    color: '#a89cc8',
    lineHeight: 18,
  },
  dreamItemDelete: {
    fontSize: 18,
    color: '#e07a7a',
    paddingLeft: 12,
  },
  deleteWarningModal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: '#5a3a3a',
  },
  deleteWarningIcon: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 12,
  },
  deleteWarningTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e07a7a',
    textAlign: 'center',
    marginBottom: 16,
  },
  deleteWarningBody: {
    fontSize: 15,
    color: '#c0b4e0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  deleteWarningBold: {
    fontWeight: '700',
    color: '#e0d4f7',
  },
  subscriptionWarning: {
    backgroundColor: '#2a2040',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#6b4e9e',
  },
  subscriptionWarningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e0d4f7',
    marginBottom: 8,
  },
  subscriptionWarningBody: {
    fontSize: 14,
    color: '#a89cc8',
    lineHeight: 20,
    marginBottom: 12,
  },
  manageSubButton: {
    backgroundColor: '#6b4e9e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  manageSubButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteConfirmButton: {
    backgroundColor: '#8b2a2a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteConfirmButtonDisabled: {
    backgroundColor: '#3a2a2a',
    opacity: 0.6,
  },
  deleteConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteConfirmButtonTextDisabled: {
    color: '#8b7fa8',
  },
  deleteWarningCancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteWarningCancelText: {
    color: '#9b7fd4',
    fontSize: 16,
    fontWeight: '600',
  },
});
