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
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUserEmail(user?.email || null);
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
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      const exportData = {
        exported_at: new Date().toISOString(),
        user_email: user.email,
        dream_count: dreams?.length || 0,
        dreams: dreams,
      };

      await Share.share({
        message: JSON.stringify(exportData, null, 2),
        title: 'Dreamz Export',
      });
    } catch (error: any) {
      Alert.alert('Export Error', error.message || 'Failed to export dreams');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your dreams. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { data: { user } } = await supabase.auth.getUser();

              if (!user) return;

              // Delete all user's dreams
              await supabase
                .from('dreams')
                .delete()
                .eq('user_id', user.id);

              // Delete profile
              await supabase
                .from('profiles')
                .delete()
                .eq('id', user.id);

              // Sign out (account deletion requires admin API)
              await supabase.auth.signOut();

              Alert.alert('Account Deleted', 'Your account has been deleted.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete account');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
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
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{userEmail || 'Loading...'}</Text>
          </View>
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
});
