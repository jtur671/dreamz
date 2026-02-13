import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [lastDreamTitle, setLastDreamTitle] = useState<string | null>(null);
  const [dreamCount, setDreamCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      async function loadStats() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('dreams')
          .select('reading')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          setLastDreamTitle(data[0].reading?.title || null);
        }

        const { count } = await supabase
          .from('dreams')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('deleted_at', null);

        setDreamCount(count || 0);
      }
      loadStats();
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.moonGlow}>
              <Text style={styles.moonIcon}>{'\u{1F319}'}</Text>
            </View>
            <Text style={styles.greeting}>Welcome, Dreamer</Text>
            <Text style={styles.subtitle}>What did you dream last night?</Text>
          </View>

          <View style={styles.actions}>
            {lastDreamTitle && (
              <TouchableOpacity
                style={styles.lastDreamCard}
                onPress={() => navigation.navigate('Grimoire')}
              >
                <Text style={styles.lastDreamLabel}>Last reading</Text>
                <Text style={styles.lastDreamTitle}>{lastDreamTitle}</Text>
                {dreamCount > 1 && (
                  <Text style={styles.dreamCountText}>
                    {dreamCount} dreams in your grimoire
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.newDreamButton}
              onPress={() => navigation.navigate('NewDream')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#6b4e9e', '#8b6cc1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                <Text style={styles.newDreamButtonText}>Record a Dream</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.grimoireButton}
              onPress={() => navigation.navigate('Grimoire')}
            >
              <Text style={styles.grimoireButtonText}>View Your Grimoire</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.tagline}>Your dreams are private. Always.</Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingTop: 48,
  },
  moonGlow: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(155,127,212,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  moonIcon: {
    fontSize: 48,
  },
  ctaGradient: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  greeting: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e0d4f7',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#a89cc8',
    textAlign: 'center',
  },
  actions: {
    // gap: 16 removed - causes Android type casting issues
  },
  lastDreamCard: {
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a3a5e',
    borderLeftWidth: 4,
    borderLeftColor: '#9b7fd4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  lastDreamLabel: {
    fontSize: 11,
    color: '#8b7fa8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  lastDreamTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e0d4f7',
  },
  dreamCountText: {
    fontSize: 12,
    color: '#6b5b8a',
    marginTop: 4,
  },
  newDreamButton: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  newDreamButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  grimoireButton: {
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a5e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  grimoireButtonText: {
    color: '#e0d4f7',
    fontSize: 18,
    fontWeight: '600',
  },
  tagline: {
    color: '#5a5a7a',
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 24,
  },
});
