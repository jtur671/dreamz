import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography, spacing, radii } from '../theme';
import { PaperGrain } from '../components/PaperGrain';
import { SymbolIcon } from '../components/SymbolIcon';
import { useDreams } from '../hooks/useDreams';
import { deleteDream as deleteDreamService } from '../lib/dreamService';
import { getDreamStats } from '../lib/insightsService';
import { useAIConsent } from '../hooks/useAIConsent';
import AIConsentModal from '../components/AIConsentModal';
import { refreshDreamImageUrl, getDreamImagePath } from '../lib/imageService';
import { supabase } from '../lib/supabase';
import type { Dream } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';


// Stop words for normalizing AI symbol names ("River full of blood" → "river")
const SYMBOL_STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
  'from', 'into', 'through', 'my', 'your', 'his', 'her', 'its', 'our',
  'their', 'full', 'dark', 'old', 'big', 'huge', 'small', 'little',
]);

/** Extract all meaningful keywords from a symbol name for grouping. */
function extractSymbolKeywords(name: string): string[] {
  return name.toLowerCase().split(/\s+/).filter(w => !SYMBOL_STOP_WORDS.has(w) && w.length >= 2);
}

type GrimoireScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDateGroupLabel(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dreamDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - dreamDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateBadge(dateString: string): { month: string; day: string } {
  const date = new Date(dateString);
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day: date.getDate().toString(),
  };
}

/**
 * Dream card with image background that auto-refreshes expired signed URLs.
 */
function DreamImageCard({
  dream,
  imageUrl: initialUrl,
  style,
  imageStyle,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  children,
}: {
  dream: Dream;
  imageUrl: string;
  style: any;
  imageStyle: any;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
  children: React.ReactNode;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [fallen, setFallen] = useState(false);
  const refreshAttempted = useRef(false);

  const handleError = useCallback(async () => {
    if (refreshAttempted.current) {
      setFallen(true);
      return;
    }
    refreshAttempted.current = true;

    let storagePath = dream.reading?.image_path;
    if (!storagePath) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        storagePath = getDreamImagePath(user.id, dream.id);
      }
    }
    if (!storagePath) {
      setFallen(true);
      return;
    }

    const freshUrl = await refreshDreamImageUrl(storagePath);
    if (freshUrl) {
      setUrl(freshUrl);
    } else {
      setFallen(true);
    }
  }, [dream]);

  if (fallen) {
    // Fall back to non-image card rendering (caller handles this)
    return null;
  }

  return (
    <TouchableOpacity
      testID="grimoire-dream-item"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={style}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <ImageBackground
        source={{ uri: url }}
        style={styles.journalCardImage}
        imageStyle={imageStyle}
        onError={handleError}
      >
        <View style={styles.journalCardOverlay}>
          {children}
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

export default function GrimoireScreen({ navigation }: GrimoireScreenProps) {
  const { contentStyle } = useResponsiveLayout();
  const { dreams, loading, error, refresh } = useDreams();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePill, setActivePill] = useState<string | null>(null);
  const { hasConsent, grantConsent } = useAIConsent();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Compute recurring symbol pills (threshold: 4+ dreams containing the symbol)
  // Normalizes compound names ("River full of blood" → "river") to group variants
  const symbolPills = useMemo(() => {
    const symbolCounts = new Map<string, number>();
    for (const dream of dreams) {
      if (!dream.reading?.symbols) continue;
      const seen = new Set<string>();
      for (const symbol of dream.reading.symbols) {
        for (const keyword of extractSymbolKeywords(symbol.name)) {
          if (!seen.has(keyword)) {
            seen.add(keyword);
            symbolCounts.set(keyword, (symbolCounts.get(keyword) || 0) + 1);
          }
        }
      }
    }

    return Array.from(symbolCounts.entries())
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [dreams]);

  // Reset active pill if the selected symbol is no longer available
  useEffect(() => {
    if (activePill && !symbolPills.some(p => p.name === activePill)) {
      setActivePill(null);
    }
  }, [activePill, symbolPills]);

  // Refresh when tab is focused
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleDreamPress = useCallback((dream: Dream) => {
    if (dream.reading) {
      navigation.navigate('Reading', {
        reading: dream.reading,
        dreamId: dream.id,
        dreamText: dream.dream_text,
        fromGrimoire: true,
      });
    }
  }, [navigation]);

  const handleDeleteDream = useCallback(async (dreamId: string) => {
    const result = await deleteDreamService(dreamId);
    if (!result.success) {
      Alert.alert('Error', result.error);
      return;
    }
    await refresh();
  }, [refresh]);

  const handleDeletePress = useCallback((dream: Dream) => {
    const title = dream.reading?.title || 'this dream';
    Alert.alert(
      'Delete Dream',
      `Are you sure you want to delete "${title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteDream(dream.id),
        },
      ]
    );
  }, [handleDeleteDream]);

  const grimoireSubtitle = useMemo(() => {
    const total = dreams.length;
    const withReadings = dreams.filter(d => d.reading).length;
    if (total === 0) return 'No dreams recorded yet';
    if (withReadings === total) return `${total} dream${total !== 1 ? 's' : ''} with readings`;
    if (withReadings === 0) return `${total} dream${total !== 1 ? 's' : ''} awaiting interpretation`;
    return `${withReadings} of ${total} dreams interpreted`;
  }, [dreams]);

  const dreamStreak = useMemo(() => getDreamStats(dreams).streak, [dreams]);

  // Filter dreams based on pill selection + search query (additive)
  const filteredDreams = useMemo(() => {
    return dreams.filter(dream => {
      // Pill filter (uses same keyword extraction as symbolPills computation)
      if (activePill) {
        const hasSymbol = dream.reading?.symbols?.some(
          s => extractSymbolKeywords(s.name).includes(activePill)
        );
        if (!hasSymbol) return false;
      }

      // Text search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const text = dream.dream_text.toLowerCase();
        const mood = dream.mood?.toLowerCase() || '';

        if (hasConsent === false) {
          // No-consent mode: only search dream text and mood
          if (!text.includes(query) && !mood.includes(query)) {
            return false;
          }
        } else {
          const title = dream.reading?.title?.toLowerCase() || '';
          const tags = dream.reading?.tags?.join(' ').toLowerCase() || '';
          const omen = dream.reading?.omen?.toLowerCase() || '';

          if (
            !title.includes(query) &&
            !text.includes(query) &&
            !tags.includes(query) &&
            !omen.includes(query)
          ) {
            return false;
          }
        }
      }

      return true;
    });
  }, [dreams, activePill, searchQuery, hasConsent]);

  // Group filtered dreams by date for SectionList
  const sections = useMemo(() => {
    const groups = new Map<string, Dream[]>();
    for (const dream of filteredDreams) {
      const label = getDateGroupLabel(dream.created_at);
      const existing = groups.get(label);
      if (existing) {
        existing.push(dream);
      } else {
        groups.set(label, [dream]);
      }
    }
    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [filteredDreams]);

  const renderConsentBanner = () => {
    if (hasConsent !== false || bannerDismissed || dreams.length === 0) return null;

    return (
      <View testID="grimoire-consent-banner" style={styles.consentBanner}>
        <Text style={styles.consentBannerText}>
          Your dreams are private reflections. Enable AI readings to unlock
          mystical interpretations and symbol tracking.
        </Text>
        <View style={styles.consentBannerButtons}>
          <TouchableOpacity
            testID="grimoire-consent-enable"
            style={styles.consentEnableButton}
            onPress={() => setShowConsentModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Enable Readings"
          >
            <Text style={styles.consentEnableText}>Enable Readings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="grimoire-consent-dismiss"
            onPress={() => setBannerDismissed(true)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.consentDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDream = useCallback(({ item }: { item: Dream }) => {
    const hasReading = !!item.reading;
    const title = item.reading?.title;
    const isNightmare = item.dream_type === 'nightmare';
    const isForgot = (item as any).dream_type === 'forgot';
    const dateLabel = formatDate(item.created_at);
    const dateBadge = getDateBadge(item.created_at);
    const imageUrl = item.reading?.image_url;
    const cardLabel = title
      ? `${title}, ${dateLabel}${item.mood ? ', ' + item.mood : ''}`
      : `Dream from ${dateLabel}`;

    // Forgot-dream entries get a special muted card
    if (isForgot) {
      return (
        <View
          testID="grimoire-dream-item"
          style={styles.forgotCard}
          accessibilityLabel={`No dream recalled, ${dateLabel}`}
        >
          <View style={styles.forgotIconHolder}>
            <SymbolIcon name="moon" size={28} color={colors.paper.boneFaint} strokeWidth={1.5} />
          </View>
          <View style={styles.forgotContent}>
            <Text style={styles.forgotDate}>{dateLabel}</Text>
            <Text style={styles.forgotText}>No dream recalled</Text>
            <Text style={styles.forgotEncouragement}>You still showed up.</Text>
          </View>
        </View>
      );
    }

    // No-reading cards: simplified journal entry
    if (!hasReading) {
      return (
        <TouchableOpacity
          testID="grimoire-dream-item"
          accessibilityRole="button"
          accessibilityLabel={`Dream from ${dateLabel}${item.mood ? ', ' + item.mood : ''}`}
          accessibilityHint="View dream entry"
          style={styles.journalCard}
          onPress={() => {
            Alert.alert(
              dateLabel,
              item.dream_text,
              [{ text: 'Close' }]
            );
          }}
          onLongPress={() => handleDeletePress(item)}
        >
          <View style={[
            styles.journalCardFallback,
            isNightmare && styles.journalCardFallbackNightmare,
          ]}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeMonth}>{dateBadge.month}</Text>
              <Text style={styles.dateBadgeDay}>{dateBadge.day}</Text>
            </View>
            <View style={styles.journalCardBottom}>
              {item.mood && (
                <Text style={[styles.dreamPreview, isNightmare && styles.nightmareText]}>
                  {item.mood}
                </Text>
              )}
              <Text
                style={[styles.dreamPreview, isNightmare && styles.nightmareText]}
                numberOfLines={2}
              >
                {item.dream_text}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    const previewText = item.reading?.tldr || item.dream_text;

    const cardInner = (
      <>
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeMonth}>{dateBadge.month}</Text>
          <Text style={styles.dateBadgeDay}>{dateBadge.day}</Text>
        </View>
        <View style={styles.journalCardBottom}>
          {title && (
            <Text
              style={[styles.dreamTitle, isNightmare && styles.nightmareTitle]}
              numberOfLines={1}
            >
              {title}
            </Text>
          )}
          <Text
            style={[styles.dreamPreview, isNightmare && styles.nightmareText]}
            numberOfLines={2}
          >
            {previewText}
          </Text>
        </View>
      </>
    );

    if (imageUrl) {
      return (
        <DreamImageCard
          dream={item}
          imageUrl={imageUrl}
          style={styles.journalCard}
          imageStyle={styles.journalCardImageStyle}
          onPress={() => handleDreamPress(item)}
          onLongPress={() => handleDeletePress(item)}
          accessibilityLabel={cardLabel}
          accessibilityHint={hasReading ? 'Double tap to view reading' : 'No reading available'}
        >
          {cardInner}
        </DreamImageCard>
      );
    }

    return (
      <TouchableOpacity
        testID="grimoire-dream-item"
        accessibilityRole="button"
        accessibilityLabel={cardLabel}
        accessibilityHint={hasReading ? 'Double tap to view reading' : 'No reading available'}
        style={styles.journalCard}
        onPress={() => handleDreamPress(item)}
        onLongPress={() => handleDeletePress(item)}
        disabled={!hasReading}
      >
        <View style={[
          styles.journalCardFallback,
          isNightmare && styles.journalCardFallbackNightmare,
        ]}>
          {cardInner}
        </View>
      </TouchableOpacity>
    );
  }, [handleDreamPress, handleDeletePress]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.ochre.gold} />
      </View>
    );
  }

  if (error && dreams.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <PaperGrain />
        <View style={styles.gradient}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Could not load your dreams</Text>
            <Text style={styles.emptySubtext}>{error}</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleRefresh}>
              <Text style={styles.emptyButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <PaperGrain />
      <View style={styles.gradient}>
        <View style={[styles.innerContainer, contentStyle]}>
        <AIConsentModal
          visible={showConsentModal}
          onAllow={async () => {
            setShowConsentModal(false);
            await grantConsent();
          }}
          onDecline={() => setShowConsentModal(false)}
        />

        <Text style={styles.title}>Your Grimoire</Text>

        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>{grimoireSubtitle}</Text>
          {dreamStreak >= 2 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>
                {dreamStreak}-day streak
              </Text>
            </View>
          )}
        </View>

        {renderConsentBanner()}

        {hasConsent !== false && dreams.length > 0 && symbolPills.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillRow}
            contentContainerStyle={styles.pillRowContent}
          >
            <TouchableOpacity
              testID="grimoire-pill-all"
              style={[styles.pill, !activePill && styles.pillActive]}
              onPress={() => setActivePill(null)}
              accessibilityRole="button"
              accessibilityLabel={`All dreams, ${dreams.length} total`}
              accessibilityState={{ selected: !activePill }}
            >
              <Text style={[styles.pillText, !activePill && styles.pillTextActive]}>
                All ({dreams.length})
              </Text>
            </TouchableOpacity>
            {symbolPills.map(({ name, count }) => (
              <TouchableOpacity
                key={name}
                testID={`grimoire-pill-${name}`}
                style={[styles.pill, activePill === name && styles.pillActive]}
                onPress={() => setActivePill(activePill === name ? null : name)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${name}, ${count} dreams`}
                accessibilityState={{ selected: activePill === name }}
              >
                <Text style={[styles.pillText, activePill === name && styles.pillTextActive]}>
                  {name.charAt(0).toUpperCase() + name.slice(1)} ({count})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {dreams.length > 0 && (
          <View style={styles.searchContainer}>
            <TextInput
              testID="grimoire-search-input"
              style={styles.searchInput}
              placeholder="Search dreams, symbols, tags..."
              placeholderTextColor={colors.paper.boneFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => { /* dismiss keyboard via returnKeyType="done" */ }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                testID="grimoire-search-clear"
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {dreams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconHolder}>
              <SymbolIcon
                name={hasConsent === false ? 'scroll' : 'book'}
                size={64}
                color={colors.ochre.gold}
                strokeWidth={1.5}
              />
            </View>
            <Text style={styles.emptyText}>
              {hasConsent === false
                ? 'Your journal awaits its first entry'
                : 'Your grimoire awaits its first entry'}
            </Text>
            <Text style={styles.emptySubtext}>
              Record a dream to begin your journey
            </Text>
            <TouchableOpacity
              testID="grimoire-empty-record"
              style={styles.emptyButton}
              onPress={() => navigation.navigate('NewDream')}
            >
              <Text style={styles.emptyButtonText}>Record a Dream</Text>
            </TouchableOpacity>
          </View>
        ) : filteredDreams.length === 0 ? (
          <View testID="grimoire-empty-no-results" style={styles.emptyContainer}>
            <View style={styles.emptyIconHolder}>
              <SymbolIcon name="eye" size={64} color={colors.ochre.gold} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyText}>
              No dreams match your search
            </Text>
            <Text style={styles.emptySubtext}>
              Try different keywords or clear the search
            </Text>
          </View>
        ) : (
          <SectionList
            testID="grimoire-dream-list"
            sections={sections}
            renderItem={renderDream}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={styles.sectionHeader}>{title}</Text>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            stickySectionHeadersEnabled={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.ochre.gold}
              />
            }
          />
        )}
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
  gradient: {
    flex: 1,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
  },
  innerContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.ink.aubergine,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 36,
    color: colors.paper.bone,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.paper.boneMuted,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  streakBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ochre.gold,
  },
  streakText: {
    ...typography.label,
    fontSize: 10,
    color: colors.ochre.gold,
  },
  pillRow: {
    height: 44,
    marginBottom: spacing.md,
    flexShrink: 0,
  },
  pillRowContent: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.aubergineHair,
  },
  pillActive: {
    borderColor: colors.ochre.gold,
    backgroundColor: colors.ochre.gold,
  },
  pillText: {
    ...typography.caption,
    color: colors.paper.boneMuted,
  },
  pillTextActive: {
    color: colors.ink.aubergine,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: spacing.md,
    color: colors.paper.bone,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink.aubergineHair,
  },
  clearButton: {
    marginLeft: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  clearButtonText: {
    ...typography.label,
    fontSize: 10,
    color: colors.ochre.gold,
  },
  sectionHeader: {
    ...typography.label,
    fontSize: 10,
    color: colors.ochre.gold,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  journalCard: {
    marginBottom: spacing.md,
    height: 180,
    overflow: 'hidden',
    borderRadius: radii.card,
  },
  journalCardImage: {
    flex: 1,
  },
  journalCardImageStyle: {
    borderRadius: radii.card,
  },
  journalCardOverlay: {
    flex: 1,
    borderRadius: radii.card,
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: 'rgba(42,19,50,0.55)',
  },
  journalCardFallback: {
    flex: 1,
    borderRadius: radii.card,
    justifyContent: 'space-between',
    padding: spacing.md,
    overflow: 'hidden',
    backgroundColor: colors.ink.aubergineLift,
    borderLeftWidth: 2,
    borderLeftColor: colors.ochre.gold,
  },
  journalCardFallbackNightmare: {
    borderLeftColor: colors.nightmare.vermilion,
  },
  dateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.ochre.gold,
  },
  dateBadgeMonth: {
    ...typography.label,
    fontSize: 9,
    color: colors.ochre.gold,
  },
  dateBadgeDay: {
    ...typography.display,
    fontSize: 18,
    lineHeight: 20,
    color: colors.paper.bone,
  },
  journalCardBottom: {
    gap: spacing.xs / 2,
  },
  dreamTitle: {
    ...typography.title,
    fontSize: 17,
    color: colors.paper.bone,
  },
  nightmareTitle: {
    color: colors.paper.bone,
  },
  dreamPreview: {
    ...typography.caption,
    fontSize: 13,
    color: colors.paper.boneMuted,
  },
  nightmareText: {
    color: colors.paper.boneMuted,
  },
  noReadingIndicator: {
    ...typography.caption,
    color: colors.paper.boneFaint,
    fontStyle: 'italic',
  },
  forgotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    padding: spacing.base,
    opacity: 0.7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.aubergineHair,
    borderStyle: 'dashed',
  },
  forgotIconHolder: {
    marginRight: spacing.md,
  },
  forgotContent: {
    flex: 1,
  },
  forgotDate: {
    ...typography.label,
    fontSize: 10,
    color: colors.paper.boneFaint,
    marginBottom: spacing.xs / 2,
  },
  forgotText: {
    ...typography.serifBody,
    fontSize: 15,
    color: colors.paper.boneMuted,
    marginBottom: spacing.xs / 2,
  },
  forgotEncouragement: {
    ...typography.caption,
    color: colors.paper.boneFaint,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.gutter,
  },
  emptyIconHolder: {
    marginBottom: spacing.base,
  },
  emptyText: {
    ...typography.title,
    color: colors.paper.bone,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.serifBody,
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.paper.boneMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyButton: {
    backgroundColor: colors.paper.bone,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.button,
  },
  emptyButtonText: {
    ...typography.subtitle,
    fontSize: 15,
    color: colors.ink.aubergine,
  },
  consentBanner: {
    padding: spacing.base,
    marginBottom: spacing.base,
    borderLeftWidth: 2,
    borderLeftColor: colors.ochre.gold,
    backgroundColor: colors.ink.aubergineLift,
  },
  consentBannerText: {
    ...typography.body,
    color: colors.paper.boneMuted,
    marginBottom: spacing.md,
  },
  consentBannerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consentEnableButton: {
    backgroundColor: colors.paper.bone,
    borderRadius: radii.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  consentEnableText: {
    ...typography.label,
    fontSize: 10,
    color: colors.ink.aubergine,
  },
  consentDismissText: {
    ...typography.label,
    fontSize: 10,
    color: colors.paper.boneFaint,
  },
});
