import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ViewShot from 'react-native-view-shot';
import type { DreamReading, DreamSymbol } from '../types';
import { generateDreamImage } from '../lib/dreamService';
import { supabase } from '../lib/supabase';
import { refreshDreamImageUrl, getDreamImagePath } from '../lib/imageService';
import PaintBrushAnimation from '../components/PaintBrushAnimation';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { colors, typography, spacing, radii } from '../theme';
import { PaperGrain } from '../components/PaperGrain';

type ReadingScreenParams = {
  reading: DreamReading;
  dreamId: string;
  dreamText?: string;
  fromGrimoire?: boolean;
  subscriptionTier?: 'free' | 'premium';
};

export default function ReadingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute();
  const { contentStyle, screenWidth } = useResponsiveLayout();
  const params = route.params as ReadingScreenParams;
  const { reading, dreamText, fromGrimoire = false, subscriptionTier } = params;
  const isPremium = subscriptionTier === 'premium' || fromGrimoire;
  const [imageFailed, setImageFailed] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(reading.image_url || null);
  const imageRefreshAttempted = useRef(false);

  const viewShotRef = useRef<ViewShot>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showDreamText, setShowDreamText] = useState(false);
  const [dictionarySymbols, setDictionarySymbols] = useState<Set<string>>(new Set());

  // Check which reading symbols exist in the curated dictionary (case-insensitive)
  useEffect(() => {
    if (!reading.symbols?.length) return;
    const names = reading.symbols.map((s) => s.name);
    // Use ilike filters for case-insensitive matching
    const filters = names.map((n) => `name.ilike.${n}`).join(',');
    supabase
      .from('symbols')
      .select('name')
      .or(filters)
      .then(({ data }) => {
        if (data?.length) {
          // Map DB names back to reading symbol names (case-insensitive)
          const dbNamesLower = new Set(data.map((d: { name: string }) => d.name.toLowerCase()));
          setDictionarySymbols(new Set(names.filter((n) => dbNamesLower.has(n.toLowerCase()))));
        }
      })
      .catch(() => {});
  }, [reading.symbols]);

  // When the image fails to load (e.g. expired signed URL), try refreshing
  const handleImageError = useCallback(async () => {
    if (imageRefreshAttempted.current) {
      setImageFailed(true);
      return;
    }
    imageRefreshAttempted.current = true;

    // Try to get a fresh signed URL using the stored path or derived path
    let storagePath = reading.image_path;

    if (!storagePath && params.dreamId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        storagePath = getDreamImagePath(user.id, params.dreamId);
      }
    }

    if (!storagePath) {
      setImageFailed(true);
      return;
    }

    const freshUrl = await refreshDreamImageUrl(storagePath);
    if (freshUrl) {
      setImageUrl(freshUrl);
    } else {
      setImageFailed(true);
    }
  }, [reading, params.dreamId]);

  // Lazy-load dream image if not already present (premium only)
  useEffect(() => {
    if (!isPremium || imageUrl || !dreamText || !params.dreamId) return;

    const symbolName = reading.symbols?.[0]?.name;
    generateDreamImage(params.dreamId, dreamText, symbolName).then((result) => {
      if (result.success) {
        setImageUrl(result.image_url);
      }
    });
  }, [isPremium, imageUrl, dreamText, params.dreamId, reading.symbols]);

  function handleViewInGrimoire() {
    // Navigate to Grimoire tab - reset to top of stack first, then go to Grimoire
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs', params: { screen: 'Grimoire' } }],
    });
  }

  async function handleShare() {
    setShowShareCard(true);
  }

  async function captureAndShare() {
    if (!viewShotRef.current) return;

    setIsCapturing(true);
    try {
      const uri = await viewShotRef.current.capture?.();
      if (uri) {
        await Share.share({
          url: uri,
          title: reading.title,
        });
      }
    } catch {
      // Fallback to text share if image capture fails
      const tagsText = reading.tags?.length > 0 ? `\n\n#${reading.tags.join(' #')}` : '';
      const shareText = `${reading.title}

"${reading.plain_english || reading.omen}"

Ritual: ${reading.ritual}

Reflect: ${reading.journal_prompt}${tagsText}

— Interpreted with Dreamz`;

      await Share.share({
        message: shareText,
        title: reading.title,
      });
    } finally {
      setIsCapturing(false);
      setShowShareCard(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <PaperGrain />
      {/* Share Card Modal */}
      <Modal
        visible={showShareCard}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareCard(false)}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.shareModalContent}>
            <Text style={styles.shareModalTitle}>Share Your Reading</Text>

            {/* Capturable Card */}
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: 1.0 }}
              style={styles.shareCardContainer}
            >
              <View style={styles.shareCard}>
                {/* Dream Image in Card */}
                {imageUrl && (
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.shareCardImage}
                    resizeMode="cover"
                  />
                )}

                {/* Card Content */}
                <View style={styles.shareCardContent}>
                  <Text style={styles.shareCardTitle}>{reading.title}</Text>

                  <View style={styles.shareCardOmen}>
                    <Text style={styles.shareCardOmenText}>&ldquo;{reading.plain_english || reading.omen}&rdquo;</Text>
                  </View>

                  <View style={styles.shareCardTags}>
                    {(reading.tags || []).slice(0, 4).map((tag, index) => (
                      <View key={index} style={styles.shareCardTag}>
                        <Text style={styles.shareCardTagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.shareCardBranding}>DREAMZ</Text>
                </View>
              </View>
            </ViewShot>

            {/* Share Button */}
            <TouchableOpacity
              style={styles.shareImageButton}
              onPress={captureAndShare}
              disabled={isCapturing}
              accessibilityRole="button"
              accessibilityLabel="Share as image"
            >
              {isCapturing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.shareImageButtonText}>Share as Image</Text>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.shareCancelButton}
              onPress={() => setShowShareCard(false)}
              disabled={isCapturing}
              accessibilityRole="button"
              accessibilityLabel="Cancel sharing"
            >
              <Text style={styles.shareCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity
          testID="reading-back"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        testID="reading-scroll-view"
        style={styles.container}
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* Dream Image (lazy-loaded, premium only) */}
        {isPremium && !imageFailed && (imageUrl ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={[styles.dreamImage, { width: screenWidth, height: screenWidth * 0.75 }]}
              resizeMode="cover"
              onError={handleImageError}
            />
            <View style={styles.imageOverlay} />
          </View>
        ) : !fromGrimoire && dreamText ? (
          <View style={styles.imageContainer}>
            <PaintBrushAnimation />
          </View>
        ) : null)}

        {/* Title */}
        <Text testID="reading-title" style={styles.title}>{reading.title}</Text>

        {/* Expandable Dream Text */}
        {dreamText && (
          <View style={styles.dreamTextSection}>
            <TouchableOpacity
              testID="reading-dream-toggle"
              style={styles.dreamTextToggle}
              onPress={() => setShowDreamText(!showDreamText)}
              accessibilityRole="button"
              accessibilityLabel={showDreamText ? 'Hide your dream' : 'View your dream'}
            >
              <Text style={styles.dreamTextToggleText}>
                {showDreamText ? 'Hide your dream —' : 'View your dream +'}
              </Text>
            </TouchableOpacity>
            {showDreamText && (
              <View style={styles.dreamTextCard}>
                <Text style={styles.dreamTextContent}>{dreamText}</Text>
              </View>
            )}
          </View>
        )}

        {/* Plain English Interpretation */}
        {reading.plain_english && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>In Simple Terms</Text>
            <View style={styles.plainEnglishCard}>
              <Text style={styles.plainEnglishText}>{reading.plain_english}</Text>
            </View>
          </View>
        )}

        {/* TLDR Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>The Vision</Text>
          <Text style={styles.tldr}>{reading.tldr}</Text>
        </View>

        <View style={styles.sectionDivider} />

        {/* Symbols */}
        {reading.symbols?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Symbols Revealed</Text>
          {reading.symbols.map((symbol, index) => (
            <SymbolCard key={index} symbol={symbol} inDictionary={dictionarySymbols.has(symbol.name)} />
          ))}
        </View>
        )}

        <View style={styles.sectionDivider} />

        {/* Omen */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>The Omen</Text>
          <View style={styles.omenCard}>
            <Text style={styles.omenText}>{reading.omen}</Text>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* Ritual */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Suggested Ritual</Text>
          <View style={styles.ritualCard}>
            <Text style={styles.ritualText}>
              {reading.ritual && !reading.ritual.match(/[.!?"']$/)
                ? reading.ritual + '...'
                : reading.ritual}
            </Text>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* Journal Prompt */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>For Your Journal</Text>
          <View style={styles.promptCard}>
            <Text style={styles.promptText}>{reading.journal_prompt}</Text>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* Tags */}
        {reading.tags?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Themes</Text>
          <View style={styles.tagsContainer}>
            {reading.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {!fromGrimoire && (
            <TouchableOpacity
              testID="reading-grimoire-button"
              style={styles.viewGrimoireButton}
              onPress={handleViewInGrimoire}
              accessibilityLabel="View in Grimoire"
              accessibilityRole="button"
            >
              <Text style={styles.viewGrimoireButtonText}>View in Grimoire</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            testID="reading-share-button"
            style={styles.shareButton}
            onPress={handleShare}
            accessibilityLabel="Share reading"
            accessibilityRole="button"
          >
            <Text style={styles.shareButtonText}>Share Reading</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const TOOLTIP_TEXT: Record<string, string> = {
  Meaning: 'What this symbol traditionally represents across cultures and dream lore.',
  Shadow: 'The challenging side — hidden fears or tensions this symbol may reveal.',
  Guidance: 'A suggestion for working with this symbol\u2019s energy in waking life.',
};

function SymbolCard({ symbol, inDictionary }: { symbol: DreamSymbol; inDictionary: boolean }) {
  const navigation = useNavigation();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  function toggleTooltip(section: string) {
    setActiveTooltip((current) => (current === section ? null : section));
  }

  function navigateToDictionary() {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{
          name: 'MainTabs',
          params: { screen: 'Dictionary', params: { search: symbol.name } },
        }],
      })
    );
  }

  function renderSection(label: string, text: string, textStyle: object) {
    return (
      <View style={styles.symbolSection}>
        <TouchableOpacity
          testID={`symbol-tooltip-${label.toLowerCase()}`}
          style={styles.symbolSectionHeader}
          onPress={() => toggleTooltip(label)}
          accessibilityRole="button"
          accessibilityLabel={`Info about ${label}`}
        >
          <Text style={styles.symbolSectionLabel}>{label}</Text>
          <Text style={styles.tooltipIcon}>?</Text>
        </TouchableOpacity>
        {activeTooltip === label && (
          <Text testID={`symbol-tooltip-text-${label.toLowerCase()}`} style={styles.tooltipText}>{TOOLTIP_TEXT[label]}</Text>
        )}
        <Text style={textStyle}>{text}</Text>
      </View>
    );
  }

  return (
    <View style={styles.symbolCard}>
      <View style={styles.symbolNameRow}>
        <Text style={[styles.symbolName, inDictionary && styles.symbolNameLinked]}>{symbol.name}</Text>
        {inDictionary && (
          <TouchableOpacity
            testID="symbol-dictionary-badge"
            onPress={navigateToDictionary}
            accessibilityRole="link"
            accessibilityLabel={`View ${symbol.name} in dictionary`}
            style={styles.dictionaryBadge}
          >
            <Text style={styles.dictionaryBadgeText}>In the Dictionary →</Text>
          </TouchableOpacity>
        )}
      </View>
      {renderSection('Meaning', symbol.meaning, styles.symbolMeaning)}
      {renderSection('Shadow', symbol.shadow, styles.symbolShadow)}
      {renderSection('Guidance', symbol.guidance, styles.symbolGuidance)}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.ink.aubergine,
  },
  imageContainer: {
    marginHorizontal: 0,
    marginBottom: spacing.xl,
    padding: spacing.sm,
    backgroundColor: colors.paper.bone,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ochre.gold,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  dreamImage: {
    backgroundColor: colors.ink.aubergineLift,
    borderRadius: radii.image,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.gutter,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.base,
  },
  backButtonText: {
    ...typography.label,
    fontSize: 11,
    color: colors.ochre.gold,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.section,
  },
  title: {
    ...typography.display,
    fontSize: 36,
    lineHeight: 40,
    color: colors.paper.bone,
    marginBottom: spacing.xl,
    textAlign: 'left',
  },
  dreamTextSection: {
    marginBottom: spacing.xl,
  },
  dreamTextToggle: {
    paddingVertical: spacing.sm,
  },
  dreamTextToggleText: {
    ...typography.label,
    fontSize: 10,
    color: colors.ochre.gold,
  },
  dreamTextCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink.aubergineHair,
  },
  dreamTextContent: {
    ...typography.serifBody,
    fontSize: 15,
    color: colors.paper.boneMuted,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.ink.aubergineHair,
    marginBottom: spacing.base,
  },
  plainEnglishCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.aubergineHair,
  },
  plainEnglishText: {
    ...typography.bodyLarge,
    color: colors.paper.bone,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.ochre.gold,
    marginBottom: spacing.md,
  },
  tldr: {
    ...typography.serifBody,
    fontSize: 19,
    lineHeight: 28,
    color: colors.paper.bone,
    fontStyle: 'italic',
  },
  symbolCard: {
    paddingVertical: spacing.base,
    marginBottom: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink.aubergineHair,
  },
  symbolNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  symbolName: {
    ...typography.title,
    fontSize: 22,
    color: colors.paper.bone,
    flex: 1,
  },
  symbolNameLinked: {
    marginBottom: 0,
  },
  dictionaryBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginLeft: spacing.sm,
  },
  dictionaryBadgeText: {
    ...typography.label,
    fontSize: 9,
    color: colors.ochre.gold,
  },
  symbolSection: {
    marginBottom: spacing.md,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.ochre.gold,
  },
  symbolSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  symbolSectionLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.ochre.gold,
  },
  tooltipIcon: {
    ...typography.caption,
    fontSize: 11,
    color: colors.paper.boneFaint,
    marginLeft: spacing.xs,
    fontStyle: 'italic',
  },
  tooltipText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.paper.boneFaint,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  symbolMeaning: {
    ...typography.body,
    color: colors.paper.bone,
  },
  symbolShadow: {
    ...typography.body,
    color: colors.paper.boneMuted,
    fontStyle: 'italic',
  },
  symbolGuidance: {
    ...typography.body,
    color: colors.hope.sage,
  },
  omenCard: {
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    borderLeftWidth: 2,
    borderLeftColor: colors.ochre.gold,
    backgroundColor: colors.ink.aubergineLift,
  },
  omenText: {
    ...typography.serifBody,
    fontSize: 17,
    color: colors.paper.bone,
    fontStyle: 'italic',
  },
  ritualCard: {
    paddingVertical: spacing.base,
    paddingHorizontal: 0,
  },
  ritualText: {
    ...typography.bodyLarge,
    color: colors.paper.bone,
  },
  promptCard: {
    paddingVertical: spacing.base,
    paddingHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.aubergineHair,
    borderStyle: 'dashed',
  },
  promptText: {
    ...typography.serifBody,
    fontSize: 17,
    color: colors.paper.boneMuted,
    fontStyle: 'italic',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.aubergineHair,
  },
  tagText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.paper.boneMuted,
    letterSpacing: 0.3,
  },
  actionContainer: {
    marginTop: spacing.base,
    gap: spacing.md,
  },
  viewGrimoireButton: {
    backgroundColor: colors.paper.bone,
    borderRadius: radii.button,
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  viewGrimoireButtonText: {
    ...typography.subtitle,
    fontSize: 17,
    color: colors.ink.aubergine,
  },
  shareButton: {
    paddingVertical: spacing.base,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink.aubergineHair,
  },
  shareButtonText: {
    ...typography.label,
    fontSize: 11,
    color: colors.ochre.gold,
  },
  // Share Card Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(42, 19, 50, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.gutter,
  },
  shareModalContent: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  shareModalTitle: {
    ...typography.label,
    fontSize: 11,
    color: colors.ochre.gold,
    marginBottom: spacing.lg,
  },
  shareCardContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  shareCard: {
    backgroundColor: colors.paper.bone,
    padding: spacing.sm,
    overflow: 'hidden',
  },
  shareCardImage: {
    width: '100%',
    height: 220,
    backgroundColor: colors.ink.aubergineLift,
  },
  shareCardContent: {
    padding: spacing.lg,
  },
  shareCardTitle: {
    ...typography.display,
    fontSize: 26,
    lineHeight: 30,
    color: colors.ink.aubergine,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  shareCardOmen: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.base,
    borderLeftWidth: 2,
    borderLeftColor: colors.ochre.goldDeep,
  },
  shareCardOmenText: {
    ...typography.serifBody,
    fontSize: 15,
    color: colors.ink.aubergine,
    fontStyle: 'italic',
    textAlign: 'left',
  },
  shareCardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  shareCardTag: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.aubergineHair,
  },
  shareCardTagText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.ink.aubergine,
  },
  shareCardBranding: {
    ...typography.label,
    fontSize: 12,
    color: colors.ochre.goldDeep,
    textAlign: 'center',
    letterSpacing: 3,
  },
  shareImageButton: {
    backgroundColor: colors.paper.bone,
    borderRadius: radii.button,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  shareImageButtonText: {
    ...typography.subtitle,
    fontSize: 16,
    color: colors.ink.aubergine,
  },
  shareCancelButton: {
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  shareCancelButtonText: {
    ...typography.label,
    fontSize: 11,
    color: colors.paper.boneFaint,
  },
});
