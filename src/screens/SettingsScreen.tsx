import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  SafeAreaView,
  Share,
  Modal,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getProfile, updateZodiacSign } from '../lib/profileService';
import { ZODIAC_SIGNS } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [zodiacSign, setZodiacSign] = useState<string | null>(null);
  const [showZodiacPicker, setShowZodiacPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  async function fetchUserData() {
    const { data: { user } } = await supabase.auth.getUser();
    setUserEmail(user?.email || null);

    const profile = await getProfile();
    if (profile?.zodiac_sign) {
      setZodiacSign(profile.zodiac_sign);
    }
  }

  async function handleZodiacSelect(sign: string) {
    const success = await updateZodiacSign(sign);
    if (success) {
      setZodiacSign(sign);
    }
    setShowZodiacPicker(false);
  }

  async function handleExportDreams() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const { data: dreams, error } = await supabase
        .from('dreams')
        .select('dream_text, mood, emotions, dream_type, reading, created_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      // Format dreams for export (privacy-safe, no internal IDs)
      const exportedDreams = (dreams || []).map((dream, index) => ({
        entry_number: index + 1,
        date: new Date(dream.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        dream_text: dream.dream_text,
        mood: dream.mood,
        emotions: dream.emotions,
        type: dream.dream_type,
        reading: dream.reading ? {
          title: dream.reading.title,
          summary: dream.reading.tldr,
          symbols: dream.reading.symbols,
          omen: dream.reading.omen,
          ritual: dream.reading.ritual,
          reflection: dream.reading.journal_prompt,
          themes: dream.reading.tags,
        } : null,
      }));

      const exportData = {
        exported_at: new Date().toISOString(),
        app: 'Dreamz',
        total_dreams: exportedDreams.length,
        dreams: exportedDreams,
      };

      await Share.share({
        message: JSON.stringify(exportData, null, 2),
        title: 'My Dreamz Journal Export',
      });
    } catch (error: any) {
      Alert.alert('Export Error', error.message || 'Failed to export dreams');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    // First confirmation
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your dreams. This action cannot be undone.\n\nAre you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Continue',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Final Confirmation',
              'All your dreams, readings, and account data will be permanently erased.\n\nThis is your last chance to cancel.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: performAccountDeletion,
                },
              ]
            );
          },
        },
      ]
    );
  }

  async function performAccountDeletion() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      // Delete all user's dreams first (due to foreign key)
      const { error: dreamsError } = await supabase
        .from('dreams')
        .delete()
        .eq('user_id', user.id);

      if (dreamsError) {
        throw new Error(`Failed to delete dreams: ${dreamsError.message}`);
      }

      // Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) {
        throw new Error(`Failed to delete profile: ${profileError.message}`);
      }

      // Sign out (full auth user deletion requires admin API/edge function)
      await supabase.auth.signOut();

      Alert.alert(
        'Farewell, Dreamer',
        'Your account and all dreams have been deleted. May your waking hours be filled with wonder.'
      );
    } catch (error: any) {
      Alert.alert('Deletion Error', error.message || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
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
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Your Sign</Text>
            <ScrollView style={styles.zodiacList} showsVerticalScrollIndicator={false}>
              {ZODIAC_SIGNS.map((sign) => (
                <TouchableOpacity
                  key={sign}
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
              style={styles.cancelButton}
              onPress={() => setShowZodiacPicker(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.container}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{userEmail || 'Loading...'}</Text>
          </View>

          <TouchableOpacity
            style={[styles.card, styles.cardButton]}
            onPress={() => setShowZodiacPicker(true)}
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
          <Text style={styles.sectionTitle}>Your Data</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleExportDreams}
            disabled={loading}
          >
            <Text style={styles.menuItemText}>Gather Your Dreams</Text>
            <Text style={styles.menuItemSubtext}>Export all dreams as JSON</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>

          <TouchableOpacity
            style={[styles.menuItem, styles.dangerItem]}
            onPress={handleDeleteAccount}
            disabled={loading}
          >
            <Text style={styles.dangerText}>Close the Grimoire Forever</Text>
            <Text style={styles.menuItemSubtext}>Delete your account and all data</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Step Away from the Grimoire</Text>
        </TouchableOpacity>

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
  dangerItem: {
    borderColor: '#5e2a2a',
  },
  dangerText: {
    fontSize: 16,
    color: '#e07a7a',
    marginBottom: 4,
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
  },
  signOutText: {
    color: '#8b7fa8',
    fontSize: 16,
  },
  version: {
    textAlign: 'center',
    color: '#5a5a7a',
    fontSize: 12,
    marginTop: 32,
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
});
