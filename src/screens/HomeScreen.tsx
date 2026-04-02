import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { getProfile } from '../lib/profileService';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const DREAM_QUOTES = [
  { text: 'All that we see or seem is but a dream within a dream.', author: 'Edgar Allan Poe' },
  { text: 'Dreams are the royal road to the unconscious.', author: 'Sigmund Freud' },
  { text: 'Those who dream by day are cognizant of many things which escape those who dream only by night.', author: 'Edgar Allan Poe' },
  { text: 'A dream unexamined is like a letter unopened.', author: 'The Talmud' },
  { text: 'Dreams are illustrations from the book your soul is writing about you.', author: 'Marsha Norman' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
  { text: 'In dreams begins responsibility.', author: 'W.B. Yeats' },
  { text: 'Dreams are the seedlings of realities.', author: 'James Allen' },
  { text: 'Sleep is the best meditation.', author: 'Dalai Lama' },
  { text: 'We are such stuff as dreams are made on.', author: 'William Shakespeare' },
  { text: 'The dream is the small hidden door in the deepest and most intimate sanctum of the soul.', author: 'Carl Jung' },
  { text: 'Dreams are today\u2019s answers to tomorrow\u2019s questions.', author: 'Edgar Cayce' },
  { text: 'Who looks outside, dreams; who looks inside, awakes.', author: 'Carl Jung' },
  { text: 'One thing I am certain of: I do not want to be loved as much as I want to be understood.', author: 'Anais Nin' },
  { text: 'Dreaming permits each and every one of us to be quietly and safely insane every night.', author: 'William Dement' },
  { text: 'There is a time for many words, and there is also a time for sleep.', author: 'Homer' },
];

function getDailyQuote() {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DREAM_QUOTES[dayOfYear % DREAM_QUOTES.length];
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { contentStyle } = useResponsiveLayout();
  const [lastDreamTitle, setLastDreamTitle] = useState<string | null>(null);
  const [dreamCount, setDreamCount] = useState(0);
  const [displayName, setDisplayName] = useState<string | null>(null);

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 5) return 'Quiet hours';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Quiet hours';
  }

  useFocusEffect(
    useCallback(() => {
      async function loadStats() {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const [dreamResult, profile] = await Promise.all([
            supabase
              .from('dreams')
              .select('reading', { count: 'exact' })
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .order('created_at', { ascending: false })
              .limit(1),
            getProfile(),
          ]);

          setLastDreamTitle(dreamResult.data?.[0]?.reading?.title || null);
          setDreamCount(dreamResult.count || 0);
          setDisplayName(profile?.display_name || null);
        } catch {
          // Silently handle errors - home screen stats are non-critical
        }
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
        <View style={[styles.container, contentStyle]}>
          <View style={styles.header}>
            <View style={styles.moonGlow}>
              <Text style={styles.moonIcon}>{'\u{1F319}'}</Text>
            </View>
            <Text style={styles.greeting}>
              {getGreeting()}, {displayName?.split(' ')[0] || 'Dreamer'}
            </Text>
            <Text style={styles.subtitle}>What did you dream last night?</Text>
          </View>

          <View style={styles.actions}>
            {lastDreamTitle && (
              <TouchableOpacity
                testID="home-last-dream-card"
                style={styles.lastDreamCard}
                onPress={() => navigation.navigate('Grimoire')}
                accessibilityRole="button"
                accessibilityLabel={`Last reading: ${lastDreamTitle}. View your grimoire.`}
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
              testID="home-record-button"
              style={styles.newDreamButton}
              onPress={() => navigation.navigate('NewDream')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Record a Dream"
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
              testID="home-grimoire-button"
              style={styles.grimoireButton}
              onPress={() => navigation.navigate('Grimoire')}
              accessibilityRole="button"
              accessibilityLabel="View Your Grimoire"
            >
              <Text style={styles.grimoireButtonText}>View Your Grimoire</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText}>"{getDailyQuote().text}"</Text>
            <Text style={styles.quoteAuthor}>— {getDailyQuote().author}</Text>
          </View>
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
  quoteContainer: {
    paddingBottom: 24,
    paddingHorizontal: 8,
  },
  quoteText: {
    color: '#8b7fa8',
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 19,
    marginBottom: 4,
  },
  quoteAuthor: {
    color: '#7a7a9a',
    fontSize: 11,
    textAlign: 'center',
  },
});
