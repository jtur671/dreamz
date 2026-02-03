import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
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
        fromGrimoire: true,
      });
    }
  }

  function renderDream({ item }: { item: Dream }) {
    const hasReading = !!item.reading;
    const title = item.reading?.title;

    return (
      <TouchableOpacity
        style={styles.dreamCard}
        onPress={() => handleDreamPress(item)}
        disabled={!hasReading}
      >
        {title && <Text style={styles.dreamTitle}>{title}</Text>}
        <Text style={styles.dreamDate}>{formatDate(item.created_at)}</Text>
        {item.mood && <Text style={styles.dreamMood}>{item.mood}</Text>}
        <Text style={styles.dreamText} numberOfLines={3}>
          {item.dream_text}
        </Text>
        {hasReading ? (
          <Text style={styles.readingIndicator}>Tap to view reading</Text>
        ) : (
          <Text style={styles.noReadingIndicator}>No reading yet</Text>
        )}
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
          {dreams.length} dream{dreams.length !== 1 ? 's' : ''} recorded
        </Text>

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
        ) : (
          <FlatList
            data={dreams}
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
    marginBottom: 24,
  },
  listContent: {
    paddingBottom: 24,
  },
  dreamCard: {
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  dreamTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0d4f7',
    marginBottom: 4,
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
  readingIndicator: {
    fontSize: 12,
    color: '#9b7fd4',
    marginTop: 12,
    fontStyle: 'italic',
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
