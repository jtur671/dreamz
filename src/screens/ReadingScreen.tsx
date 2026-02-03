import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DreamReading, DreamSymbol } from '../types';
import { updateDreamWithReading } from '../lib/dreamService';

type ReadingScreenParams = {
  reading: DreamReading;
  dreamId: string;
  alreadySaved?: boolean;
};

export default function ReadingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute();
  const params = route.params as ReadingScreenParams;
  const { reading, dreamId, alreadySaved = false } = params;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(alreadySaved);

  async function handleSaveToGrimoire() {
    if (saved) return;

    setSaving(true);

    const result = await updateDreamWithReading(dreamId, reading);

    if (result.success) {
      setSaved(true);
      Alert.alert(
        'Saved to Grimoire',
        'Your dream reading has been preserved in your collection.'
      );
    } else {
      Alert.alert('Error', result.error);
    }

    setSaving(false);
  }

  function handleBackToHome() {
    navigation.popToTop();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToHome}
          accessibilityLabel="Back to home"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
          {!saved && (
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSaveToGrimoire}
              disabled={saving}
              accessibilityLabel="Save reading to grimoire"
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save to Grimoire</Text>
              )}
            </TouchableOpacity>
          )}

          {saved && (
            <View style={styles.savedIndicator}>
              <Text style={styles.savedText}>Saved to your Grimoire</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.homeButton}
            onPress={handleBackToHome}
            accessibilityLabel="Return to home"
            accessibilityRole="button"
          >
            <Text style={styles.homeButtonText}>Back to Home</Text>
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
        <Text style={styles.symbolText}>{symbol.meaning}</Text>
      </View>

      <View style={styles.symbolSection}>
        <Text style={styles.symbolSectionLabel}>Shadow</Text>
        <Text style={styles.symbolText}>{symbol.shadow}</Text>
      </View>

      <View style={styles.symbolSection}>
        <Text style={styles.symbolSectionLabel}>Guidance</Text>
        <Text style={styles.symbolText}>{symbol.guidance}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  symbolName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d4c4f7',
    marginBottom: 12,
  },
  symbolSection: {
    marginBottom: 10,
  },
  symbolSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8b7fa8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  symbolText: {
    fontSize: 14,
    color: '#c4b8e8',
    lineHeight: 20,
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
  saveButton: {
    backgroundColor: '#6b4e9e',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  savedIndicator: {
    backgroundColor: '#2e4540',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a7a6a',
  },
  savedText: {
    color: '#8bc4a8',
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
