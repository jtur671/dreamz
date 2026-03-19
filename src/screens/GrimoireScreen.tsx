import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useDreams } from '../hooks/useDreams';
import { deleteDream as deleteDreamService } from '../lib/dreamService';
import { getDreamStats } from '../lib/insightsService';
import type { Dream } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';


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

export default function GrimoireScreen({ navigation }: GrimoireScreenProps) {
  const { dreams, loading, error, refresh } = useDreams();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePill, setActivePill] = useState<string | null>(null);

  // Compute recurring symbol pills (threshold: 4+ dreams containing the symbol)
  const symbolPills = useMemo(() => {
    const symbolCounts = new Map<string, number>();
    for (const dream of dreams) {
      if (!dream.reading?.symbols) continue;
      const seen = new Set<string>();
      for (const symbol of dream.reading.symbols) {
        const name = symbol.name.toLowerCase();
        if (!seen.has(name)) {
          seen.add(name);
          symbolCounts.set(name, (symbolCounts.get(name) || 0) + 1);
        }
      }
    }

    return Array.from(symbolCounts.entries())
      .filter(([, count]) => count >= 4)
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
      `Are you sure you want to delete "${title}"? It can be recovered within 30 days by contacting support.`,
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
      // Pill filter
      if (activePill) {
        const hasSymbol = dream.reading?.symbols?.some(
          s => s.name.toLowerCase() === activePill
        );
        if (!hasSymbol) return false;
      }

      // Text search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const title = dream.reading?.title?.toLowerCase() || '';
        const text = dream.dream_text.toLowerCase();
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

      return true;
    });
  }, [dreams, activePill, searchQuery]);

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
          <Text style={styles.forgotIcon}>{'\u{1F319}'}</Text>
          <View style={styles.forgotContent}>
            <Text style={styles.forgotDate}>{dateLabel}</Text>
            <Text style={styles.forgotText}>No dream recalled</Text>
            <Text style={styles.forgotEncouragement}>You still showed up.</Text>
          </View>
        </View>
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
          <Text style={styles.typeIcon}>
            {isNightmare ? '\u{26A1}' : '\u{1F319}'}
          </Text>
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
          {!hasReading && (
            <Text style={styles.noReadingIndicator}>No reading yet</Text>
          )}
        </View>
      </>
    );

    if (imageUrl) {
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
          <ImageBackground
            source={{ uri: imageUrl }}
            style={styles.journalCardImage}
            imageStyle={styles.journalCardImageStyle}
          >
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.journalCardOverlay}
            >
              {cardInner}
            </LinearGradient>
          </ImageBackground>
        </TouchableOpacity>
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
        <LinearGradient
          colors={isNightmare
            ? ['#3a1a30', '#2a1528', '#1e1a2a']
            : ['#2d2860', '#252050', '#1a1a3e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.journalCardFallback]}
        >
          {/* Decorative stars for no-image cards */}
          <View style={styles.starsOverlay} pointerEvents="none">
            <View style={[styles.star, styles.star1]} />
            <View style={[styles.star, styles.star2]} />
            <View style={[styles.star, styles.starLg, styles.star3]} />
            <View style={[styles.star, styles.star4]} />
            <View style={[styles.star, styles.star5]} />
          </View>
          {/* Subtle glow accent */}
          <View style={[
            styles.glowAccent,
            isNightmare && styles.glowAccentNightmare,
          ]} pointerEvents="none" />
          {cardInner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }, [handleDreamPress, handleDeletePress]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6b4e9e" />
      </View>
    );
  }

  if (error && dreams.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradient}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{'  '}</Text>
            <Text style={styles.emptyText}>Could not load your dreams</Text>
            <Text style={styles.emptySubtext}>{error}</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleRefresh}>
              <Text style={styles.emptyButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.gradient}
      >
        <Text style={styles.title}>Your Grimoire</Text>

        <Text style={styles.subtitle}>{grimoireSubtitle}</Text>

        {dreamStreak >= 2 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>
                {dreamStreak}-day streak
              </Text>
            </View>
        )}

        {dreams.length > 0 && symbolPills.length > 0 && (
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
              placeholderTextColor="#6b5b8a"
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
            <Text style={styles.emptyIcon}>📖</Text>
            <Text style={styles.emptyText}>
              Your grimoire awaits its first entry...
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
            <Text style={styles.emptyIcon}>🔮</Text>
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
                tintColor="#6b4e9e"
              />
            }
          />
        )}
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
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0d4f7',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8b7fa8',
    marginBottom: 12,
  },
  streakBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#3a2a5e',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#6b4e9e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  streakText: {
    color: '#c9b8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  pillRow: {
    maxHeight: 52,
    marginBottom: 12,
  },
  pillRowContent: {
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  pillActive: {
    backgroundColor: '#3a3a6e',
    borderColor: '#9b7fd4',
  },
  pillText: {
    color: '#8b7fa8',
    fontSize: 14,
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#e0d4f7',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#e0d4f7',
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  clearButton: {
    marginLeft: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    color: '#9b7fd4',
    fontSize: 14,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8b7fa8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  listContent: {
    paddingBottom: 24,
  },
  journalCard: {
    borderRadius: 16,
    marginBottom: 12,
    height: 180,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  journalCardImage: {
    flex: 1,
  },
  journalCardImageStyle: {
    borderRadius: 16,
  },
  journalCardOverlay: {
    flex: 1,
    borderRadius: 16,
    justifyContent: 'space-between',
    padding: 14,
  },
  journalCardFallback: {
    flex: 1,
    borderRadius: 16,
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    borderColor: '#4a4a7a',
    overflow: 'hidden',
  },
  starsOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(200, 190, 240, 0.25)',
  },
  starLg: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(200, 190, 240, 0.35)',
  },
  star1: { top: 30, right: 40 },
  star2: { top: 55, right: 80 },
  star3: { top: 20, right: 120 },
  star4: { top: 70, right: 25 },
  star5: { top: 45, right: 150 },
  glowAccent: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(107, 78, 158, 0.15)',
  },
  glowAccentNightmare: {
    backgroundColor: 'rgba(138, 58, 90, 0.15)',
  },
  dateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(26, 26, 46, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 78, 158, 0.3)',
  },
  dateBadgeMonth: {
    fontSize: 10,
    fontWeight: '600',
    color: '#a89cc8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateBadgeDay: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e0d4f7',
  },
  journalCardBottom: {
    gap: 2,
  },
  typeIcon: {
    fontSize: 14,
  },
  dreamTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0d4f7',
  },
  nightmareTitle: {
    color: '#e8b8c8',
  },
  dreamPreview: {
    fontSize: 13,
    color: '#c0b8d8',
    lineHeight: 18,
  },
  nightmareText: {
    color: '#b89ca8',
  },
  noReadingIndicator: {
    fontSize: 12,
    color: '#6b5b8a',
    fontStyle: 'italic',
  },
  forgotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    opacity: 0.6,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  forgotIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  forgotContent: {
    flex: 1,
  },
  forgotDate: {
    fontSize: 12,
    color: '#8b7fa8',
    marginBottom: 2,
  },
  forgotText: {
    fontSize: 14,
    color: '#a89cc8',
    marginBottom: 2,
  },
  forgotEncouragement: {
    fontSize: 12,
    color: '#8b7fa8',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#e0d4f7',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8b7fa8',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#6b4e9e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
