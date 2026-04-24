import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { getProfile } from '../lib/profileService';
import { withTimeout } from '../lib/timeout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, typography, spacing, radii } from '../theme';
import { PaperGrain } from '../components/PaperGrain';
import { SymbolIcon } from '../components/SymbolIcon';

const STATS_TIMEOUT_MS = 5000;

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
          const { data: { user } } = await withTimeout(
            supabase.auth.getUser(),
            STATS_TIMEOUT_MS,
            'HomeScreen:getUser',
          );
          if (!user) return;

          const [dreamResult, profile] = await Promise.all([
            withTimeout(
              supabase
                .from('dreams')
                .select('reading', { count: 'exact' })
                .eq('user_id', user.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(1),
              STATS_TIMEOUT_MS,
              'HomeScreen:dreams',
            ),
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
      <PaperGrain />
      <View style={[styles.container, contentStyle]}>
        <View style={styles.header}>
          <View style={styles.moonHolder}>
            <SymbolIcon name="moon" size={72} color={colors.ochre.gold} strokeWidth={1.75} />
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
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Record a Dream"
          >
            <Text style={styles.newDreamButtonText}>Record a Dream</Text>
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
          <Text style={styles.quoteText}>&ldquo;{getDailyQuote().text}&rdquo;</Text>
          <Text style={styles.quoteAuthor}>— {getDailyQuote().author}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ink.aubergine,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.gutter,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.section,
  },
  moonHolder: {
    marginBottom: spacing.base,
  },
  greeting: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 36,
    color: colors.paper.bone,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.serifBody,
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.paper.boneMuted,
    textAlign: 'center',
  },
  actions: {},
  lastDreamCard: {
    backgroundColor: colors.ink.aubergineLift,
    borderRadius: radii.card,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderLeftWidth: 2,
    borderLeftColor: colors.ochre.gold,
  },
  lastDreamLabel: {
    ...typography.label,
    color: colors.ochre.gold,
    marginBottom: spacing.xs,
  },
  lastDreamTitle: {
    ...typography.title,
    fontSize: 20,
    color: colors.paper.bone,
  },
  dreamCountText: {
    ...typography.caption,
    color: colors.paper.boneFaint,
    marginTop: spacing.xs,
  },
  newDreamButton: {
    backgroundColor: colors.paper.bone,
    borderRadius: radii.button,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  newDreamButtonText: {
    ...typography.subtitle,
    color: colors.ink.aubergine,
    fontSize: 17,
  },
  grimoireButton: {
    paddingVertical: spacing.base,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink.aubergineHair,
  },
  grimoireButtonText: {
    ...typography.label,
    fontSize: 11,
    color: colors.ochre.gold,
  },
  quoteContainer: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink.aubergineHair,
    paddingTop: spacing.base,
  },
  quoteText: {
    ...typography.serifBody,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.paper.boneMuted,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  quoteAuthor: {
    ...typography.label,
    fontSize: 10,
    color: colors.paper.boneFaint,
    textAlign: 'center',
  },
});
