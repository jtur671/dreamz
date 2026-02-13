import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Share,
  Image,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ViewShot from 'react-native-view-shot';
import type { DreamReading, DreamSymbol } from '../types';
import { generateDreamImage } from '../lib/dreamService';

type ReadingScreenParams = {
  reading: DreamReading;
  dreamId: string;
  dreamText?: string;
  fromGrimoire?: boolean;
};

export default function ReadingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute();
  const params = route.params as ReadingScreenParams;
  const { reading, dreamText, fromGrimoire = false } = params;
  const [imageFailed, setImageFailed] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(reading.image_url || null);

  const viewShotRef = useRef<ViewShot>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showDreamText, setShowDreamText] = useState(false);

  // Lazy-load dream image if not already present
  useEffect(() => {
    if (imageUrl || fromGrimoire || !dreamText || !params.dreamId) return;

    const symbolName = reading.symbols?.[0]?.name;
    generateDreamImage(params.dreamId, dreamText, symbolName).then((result) => {
      if (result.success) {
        setImageUrl(result.image_url);
      }
    });
  }, []);

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
    } catch (error) {
      // Fallback to text share if image capture fails
      const tagsText = reading.tags.length > 0 ? `\n\n#${reading.tags.join(' #')}` : '';
      const shareText = `✧ ${reading.title} ✧

"${reading.omen}"

Ritual: ${reading.ritual}

Reflect: ${reading.journal_prompt}${tagsText}

---
Interpreted with Dreamz`;

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
      <LinearGradient
        colors={['#1a1a2e', '#1e1a3a', '#16213e']}
        style={styles.gradient}
      >
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
                    <Text style={styles.shareCardOmenText}>"{reading.omen}"</Text>
                  </View>

                  <View style={styles.shareCardTags}>
                    {reading.tags.slice(0, 4).map((tag, index) => (
                      <View key={index} style={styles.shareCardTag}>
                        <Text style={styles.shareCardTagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.shareCardBranding}>✧ dreamz ✧</Text>
                </View>
              </View>
            </ViewShot>

            {/* Share Button */}
            <TouchableOpacity
              style={styles.shareImageButton}
              onPress={captureAndShare}
              disabled={isCapturing}
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
            >
              <Text style={styles.shareCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Dream Image (lazy-loaded) */}
        {!imageFailed && (imageUrl ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.dreamImage}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
            <View style={styles.imageOverlay} />
          </View>
        ) : !fromGrimoire && dreamText ? (
          <View style={styles.imageContainer}>
            <View style={[styles.dreamImage, styles.imagePlaceholder]}>
              <ActivityIndicator size="small" color="#6b4e9e" />
              <Text style={styles.imagePlaceholderText}>Painting your dream...</Text>
            </View>
          </View>
        ) : null)}

        {/* Title */}
        <Text style={styles.title}>{reading.title}</Text>

        {/* Expandable Dream Text */}
        {dreamText && (
          <View style={styles.dreamTextSection}>
            <TouchableOpacity
              style={styles.dreamTextToggle}
              onPress={() => setShowDreamText(!showDreamText)}
              accessibilityRole="button"
              accessibilityLabel={showDreamText ? 'Hide your dream' : 'View your dream'}
            >
              <Text style={styles.dreamTextToggleText}>
                {showDreamText ? '▼ Hide Your Dream' : '▶ View Your Dream'}
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
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Symbols Revealed</Text>
          {reading.symbols.map((symbol, index) => (
            <SymbolCard key={index} symbol={symbol} />
          ))}
        </View>

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
            <Text style={styles.ritualText}>{reading.ritual}</Text>
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

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {!fromGrimoire && (
            <TouchableOpacity
              style={styles.viewGrimoireButton}
              onPress={handleViewInGrimoire}
              accessibilityLabel="View in Grimoire"
              accessibilityRole="button"
            >
              <Text style={styles.viewGrimoireButtonText}>View in Grimoire</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            accessibilityLabel="Share reading"
            accessibilityRole="button"
          >
            <Text style={styles.shareButtonText}>Share Reading</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

function SymbolCard({ symbol }: { symbol: DreamSymbol }) {
  return (
    <View style={styles.symbolCard}>
      <Text style={styles.symbolName}>{symbol.name}</Text>

      <View style={styles.symbolSection}>
        <Text style={styles.symbolSectionLabel}>Meaning</Text>
        <Text style={styles.symbolMeaning}>{symbol.meaning}</Text>
      </View>

      <View style={styles.symbolSection}>
        <Text style={styles.symbolSectionLabel}>Shadow</Text>
        <Text style={styles.symbolShadow}>{symbol.shadow}</Text>
      </View>

      <View style={styles.symbolSection}>
        <Text style={styles.symbolSectionLabel}>Guidance</Text>
        <Text style={styles.symbolGuidance}>{symbol.guidance}</Text>
      </View>
    </View>
  );
}

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    flex: 1,
  },
  imageContainer: {
    marginHorizontal: -24,
    marginTop: -8,
    marginBottom: 20,
    position: 'relative',
  },
  dreamImage: {
    width: screenWidth,
    height: screenWidth * 0.75,
    backgroundColor: '#252542',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e3a',
  },
  imagePlaceholderText: {
    color: '#6b5b8a',
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'transparent',
    // Gradient fade effect at bottom
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    color: '#6b4e9e',
    fontSize: 16,
    fontWeight: '500',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0d4f7',
    marginBottom: 24,
    textAlign: 'center',
  },
  dreamTextSection: {
    marginBottom: 24,
  },
  dreamTextToggle: {
    backgroundColor: '#252542',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  dreamTextToggleText: {
    color: '#9b7fd4',
    fontSize: 14,
    fontWeight: '500',
  },
  dreamTextCard: {
    backgroundColor: '#1e1e38',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  dreamTextContent: {
    color: '#c4b8e8',
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 28,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#2a2a4e',
    marginBottom: 16,
  },
  plainEnglishCard: {
    backgroundColor: '#252545',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#4a4a6e',
  },
  plainEnglishText: {
    fontSize: 16,
    color: '#e8e0f8',
    lineHeight: 26,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9b7fd4',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  tldr: {
    fontSize: 18,
    color: '#e0d4f7',
    lineHeight: 28,
    fontStyle: 'italic',
  },
  symbolCard: {
    backgroundColor: '#252542',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4a4a6e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  symbolName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f0e8ff',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  symbolSection: {
    marginBottom: 14,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#5a4a7e',
  },
  symbolSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b8a8d8',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  symbolMeaning: {
    fontSize: 15,
    color: '#e8e0f8',
    lineHeight: 22,
  },
  symbolShadow: {
    fontSize: 15,
    color: '#d8c8e8',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  symbolGuidance: {
    fontSize: 15,
    color: '#c8f0d8',
    lineHeight: 22,
  },
  omenCard: {
    backgroundColor: '#2a2a52',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#9b7fd4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  omenText: {
    fontSize: 16,
    color: '#e0d4f7',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  ritualCard: {
    backgroundColor: '#252540',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3a3a5e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ritualText: {
    fontSize: 15,
    color: '#d4c4f7',
    lineHeight: 24,
  },
  promptCard: {
    backgroundColor: '#1e1e38',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3a3a5e',
    borderStyle: 'dashed',
  },
  promptText: {
    fontSize: 15,
    color: '#c4b8e8',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#3a3a5e',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#4a4a6e',
  },
  tagText: {
    fontSize: 13,
    color: '#c4b8e8',
  },
  actionContainer: {
    marginTop: 16,
  },
  viewGrimoireButton: {
    backgroundColor: '#2e4540',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a7a6a',
    marginBottom: 12,
  },
  viewGrimoireButtonText: {
    color: '#8bc4a8',
    fontSize: 18,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: '#3a3a5e',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  shareButtonText: {
    color: '#c4b8e8',
    fontSize: 16,
    fontWeight: '500',
  },
  // Share Card Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  shareModalContent: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e0d4f7',
    marginBottom: 20,
  },
  shareCardContainer: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  shareCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    overflow: 'hidden',
  },
  shareCardImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#252542',
  },
  shareCardContent: {
    padding: 20,
  },
  shareCardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e0d4f7',
    textAlign: 'center',
    marginBottom: 16,
  },
  shareCardOmen: {
    backgroundColor: '#2e2545',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#9b7fd4',
  },
  shareCardOmenText: {
    fontSize: 15,
    color: '#d4c4f7',
    fontStyle: 'italic',
    lineHeight: 22,
    textAlign: 'center',
  },
  shareCardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  shareCardTag: {
    backgroundColor: '#3a3a5e',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  shareCardTagText: {
    fontSize: 12,
    color: '#b8a8d8',
  },
  shareCardBranding: {
    fontSize: 14,
    color: '#6b5b8a',
    textAlign: 'center',
    letterSpacing: 2,
  },
  shareImageButton: {
    backgroundColor: '#6b4e9e',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  shareImageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareCancelButton: {
    paddingVertical: 12,
    marginTop: 8,
  },
  shareCancelButtonText: {
    color: '#8b7fa8',
    fontSize: 14,
  },
});
