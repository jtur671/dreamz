import React from 'react';
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DreamReading, DreamSymbol } from '../types';

type ReadingScreenParams = {
  reading: DreamReading;
  dreamId: string;
  fromGrimoire?: boolean;
};

export default function ReadingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute();
  const params = route.params as ReadingScreenParams;
  const { reading, fromGrimoire = false } = params;

  function handleViewInGrimoire() {
    // Navigate to Grimoire tab - reset to top of stack first, then go to Grimoire
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs', params: { screen: 'Grimoire' } }],
    });
  }

  function handleBackToGrimoire() {
    navigation.popToTop();
  }

  async function handleShare() {
    // Share only the reading content - never the dream text (privacy)
    const shareText = `${reading.title}

"${reading.omen}"

Ritual: ${reading.ritual}

Reflect: ${reading.journal_prompt}

#${reading.tags.join(' #')}

---
Interpreted with Dreamz`;

    try {
      await Share.share({
        message: shareText,
        title: reading.title,
      });
    } catch (error) {
      // User cancelled or share failed silently
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToGrimoire}
          accessibilityLabel="Back to Grimoire"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Grimoire</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Dream Image */}
        {reading.image_url && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: reading.image_url }}
              style={styles.dreamImage}
              resizeMode="cover"
            />
            <View style={styles.imageOverlay} />
          </View>
        )}

        {/* Title */}
        <Text style={styles.title}>{reading.title}</Text>

        {/* TLDR Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>The Vision</Text>
          <Text style={styles.tldr}>{reading.tldr}</Text>
        </View>

        {/* Symbols */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Symbols Revealed</Text>
          {reading.symbols.map((symbol, index) => (
            <SymbolCard key={index} symbol={symbol} />
          ))}
        </View>

        {/* Omen */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>The Omen</Text>
          <View style={styles.omenCard}>
            <Text style={styles.omenText}>{reading.omen}</Text>
          </View>
        </View>

        {/* Ritual */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Suggested Ritual</Text>
          <View style={styles.ritualCard}>
            <Text style={styles.ritualText}>{reading.ritual}</Text>
          </View>
        </View>

        {/* Journal Prompt */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>For Your Journal</Text>
          <View style={styles.promptCard}>
            <Text style={styles.promptText}>{reading.journal_prompt}</Text>
          </View>
        </View>

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

          <TouchableOpacity
            style={styles.homeButton}
            onPress={handleBackToGrimoire}
            accessibilityLabel="Return to Grimoire"
            accessibilityRole="button"
          >
            <Text style={styles.homeButtonText}>Back to Grimoire</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  section: {
    marginBottom: 28,
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
    backgroundColor: '#2e2545',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#9b7fd4',
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
    gap: 8,
  },
  tag: {
    backgroundColor: '#3a3a5e',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  tagText: {
    fontSize: 13,
    color: '#c4b8e8',
  },
  actionContainer: {
    marginTop: 16,
    gap: 12,
  },
  viewGrimoireButton: {
    backgroundColor: '#2e4540',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a7a6a',
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
  },
  shareButtonText: {
    color: '#c4b8e8',
    fontSize: 16,
    fontWeight: '500',
  },
  homeButton: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  homeButtonText: {
    color: '#a89cc8',
    fontSize: 16,
    fontWeight: '500',
  },
});
