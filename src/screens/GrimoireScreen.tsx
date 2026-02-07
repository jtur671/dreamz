import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import type { Dream } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type GrimoireScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function GrimoireScreen({ navigation }: GrimoireScreenProps) {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Refresh when tab is focused
  useFocusEffect(
    useCallback(() => {
      fetchDreams();
    }, [])
  );

  async function fetchDreams() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('dreams')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDreams(data);
    }
    setLoading(false);
    setRefreshing(false);
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchDreams();
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function handleDreamPress(dream: Dream) {
    if (dream.reading) {
      navigation.navigate('Reading', {
        reading: dream.reading,
        dreamId: dream.id,
        dreamText: dream.dream_text,
        fromGrimoire: true,
      });
    }
  }

  function handleDeletePress(dream: Dream) {
    const title = dream.reading?.title || 'this dream';
    Alert.alert(
      'Delete Dream',
      `Are you sure you want to delete "${title}"? It can be recovered within 30 days by contacting support.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteDream(dream.id),
        },
      ]
    );
  }

  async function deleteDream(dreamId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    // Soft delete - set deleted_at timestamp instead of hard delete
    // Include user_id check for defense in depth (RLS also protects)
    const { error } = await supabase
      .from('dreams')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', dreamId)
      .eq('user_id', user.id);

    if (error) {
      Alert.alert('Error', 'Failed to delete dream. Please try again.');
      return;
    }

    // Remove from local state
    setDreams(dreams.filter(d => d.id !== dreamId));
  }

  // Generate subtitle based on dream count and reading status
  function getGrimoireSubtitle(dreamList: Dream[]): string {
    const total = dreamList.length;
    const withReadings = dreamList.filter(d => d.reading).length;

    if (total === 0) {
      return 'No dreams recorded yet';
    }

    if (withReadings === total) {
      return `${total} dream${total !== 1 ? 's' : ''} with readings`;
    }

    if (withReadings === 0) {
      return `${total} dream${total !== 1 ? 's' : ''} awaiting interpretation`;
    }

    return `${withReadings} of ${total} dreams interpreted`;
  }

  // Filter dreams based on search query
  const filteredDreams = dreams.filter(dream => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const title = dream.reading?.title?.toLowerCase() || '';
    const text = dream.dream_text.toLowerCase();
    const tags = dream.reading?.tags?.join(' ').toLowerCase() || '';
    const omen = dream.reading?.omen?.toLowerCase() || '';

    return (
      title.includes(query) ||
      text.includes(query) ||
      tags.includes(query) ||
      omen.includes(query)
    );
  });

  function renderDream({ item }: { item: Dream }) {
    const hasReading = !!item.reading;
    const title = item.reading?.title;
    const isNightmare = item.dream_type === 'nightmare';

    return (
      <TouchableOpacity
        style={[
          styles.dreamCard,
          isNightmare && styles.nightmareCard,
        ]}
        onPress={() => handleDreamPress(item)}
        onLongPress={() => handleDeletePress(item)}
        disabled={!hasReading}
      >
        <View style={[
          styles.cardAccent,
          isNightmare && styles.nightmareAccent,
        ]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderText}>
              <View style={styles.titleRow}>
                <Text style={styles.typeIcon}>
                  {isNightmare ? '\u{26A1}' : '\u{1F319}'}
                </Text>
                {title && (
                  <Text style={[
                    styles.dreamTitle,
                    isNightmare && styles.nightmareTitle,
                  ]}>
                    {title}
                  </Text>
                )}
              </View>
              <Text style={styles.dreamDate}>{formatDate(item.created_at)}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeletePress(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          {item.mood && <Text style={styles.dreamMood}>{item.mood}</Text>}
          <Text style={[
            styles.dreamText,
            isNightmare && styles.nightmareText,
          ]} numberOfLines={3}>
            {item.dream_text}
          </Text>
          {hasReading ? (
            <Text style={[
              styles.readingIndicator,
              isNightmare && styles.nightmareIndicator,
            ]}>
              Tap to view reading
            </Text>
          ) : (
            <Text style={styles.noReadingIndicator}>No reading yet</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6b4e9e" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Your Grimoire</Text>
        <Text style={styles.subtitle}>
          {getGrimoireSubtitle(dreams)}
        </Text>

        {dreams.length > 0 && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search dreams, symbols, tags..."
              placeholderTextColor="#6b5b8a"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
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
              style={styles.emptyButton}
              onPress={() => navigation.navigate('NewDream')}
            >
              <Text style={styles.emptyButtonText}>Record a Dream</Text>
            </TouchableOpacity>
          </View>
        ) : filteredDreams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔮</Text>
            <Text style={styles.emptyText}>
              No dreams match your search
            </Text>
            <Text style={styles.emptySubtext}>
              Try different keywords or clear the search
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredDreams}
            renderItem={renderDream}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#6b4e9e"
              />
            }
          />
        )}
      </View>
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
    backgroundColor: '#1a1a2e',
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
    marginBottom: 16,
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
  listContent: {
    paddingBottom: 24,
  },
  dreamCard: {
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a5e',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  nightmareCard: {
    backgroundColor: '#2e1a2a',
    borderColor: '#5a2a4a',
  },
  cardAccent: {
    width: 4,
    backgroundColor: '#9b7fd4',
  },
  nightmareAccent: {
    backgroundColor: '#8a3a5a',
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    color: '#8b7fa8',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dreamTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0d4f7',
    marginBottom: 4,
    flex: 1,
  },
  nightmareTitle: {
    color: '#e8b8c8',
  },
  dreamDate: {
    fontSize: 12,
    color: '#8b7fa8',
    marginBottom: 4,
  },
  dreamMood: {
    fontSize: 12,
    color: '#6b4e9e',
    marginBottom: 8,
  },
  dreamText: {
    fontSize: 15,
    color: '#a89cc8',
    lineHeight: 22,
  },
  nightmareText: {
    color: '#b89ca8',
  },
  readingIndicator: {
    fontSize: 12,
    color: '#9b7fd4',
    marginTop: 12,
    fontStyle: 'italic',
  },
  nightmareIndicator: {
    color: '#a87898',
  },
  noReadingIndicator: {
    fontSize: 12,
    color: '#6b5b8a',
    marginTop: 12,
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
