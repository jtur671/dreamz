import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoute } from '@react-navigation/native';
import {
  searchSymbols,
  fetchSymbols,
  fetchSymbolsByCategory,
  type Symbol,
} from '../lib/symbolService';

// Display labels → DB values are lowercase
const CATEGORIES = [
  { label: 'All', value: 'All' },
  { label: 'Nature', value: 'nature' },
  { label: 'Animal', value: 'animal' },
  { label: 'Person', value: 'person' },
  { label: 'Object', value: 'object' },
  { label: 'Action', value: 'action' },
  { label: 'Place', value: 'place' },
  { label: 'Body', value: 'body' },
  { label: 'Theme', value: 'theme' },
  { label: 'Celestial', value: 'celestial' },
];

const PAGE_SIZE = 50;

export default function DictionaryScreen() {
  const route = useRoute();
  const routeSearch = (route.params as { search?: string } | undefined)?.search;
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState(routeSearch || '');
  const [debouncedQuery, setDebouncedQuery] = useState(routeSearch || '');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search: only fire query after 400ms of no typing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const loadSymbols = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    const offset = reset ? 0 : offsetRef.current;
    let result;

    if (debouncedQuery.trim()) {
      result = await searchSymbols(debouncedQuery.trim(), PAGE_SIZE, offset);
    } else if (activeCategory !== 'All') {
      result = await fetchSymbolsByCategory(activeCategory, PAGE_SIZE, offset);
    } else {
      result = await fetchSymbols(PAGE_SIZE, offset);
    }

    if (result.data) {
      if (reset) {
        setSymbols(result.data);
      } else {
        setSymbols(prev => [...prev, ...result.data]);
      }
      setHasMore(result.data.length === PAGE_SIZE);
      offsetRef.current = offset + result.data.length;
    }

    setLoading(false);
    setLoadingMore(false);
  }, [debouncedQuery, activeCategory]);

  useEffect(() => {
    loadSymbols(true);
  }, [loadSymbols]);

  // Pick up search param from navigation (e.g. tapping a symbol in Insights)
  useEffect(() => {
    if (routeSearch) {
      setSearchQuery(routeSearch);
      setDebouncedQuery(routeSearch);
    }
  }, [routeSearch]);

  function handleCategoryPress(category: string) {
    setActiveCategory(category);
    setExpandedSymbol(null);
  }

  function handleEndReached() {
    if (!loadingMore && hasMore && !loading) {
      loadSymbols(false);
    }
  }

  function toggleExpand(name: string) {
    setExpandedSymbol(expandedSymbol === name ? null : name);
  }

  function isEnriched(symbol: Symbol): boolean {
    return !!(symbol.shadow_meaning || symbol.guidance);
  }

  function renderSymbol({ item }: { item: Symbol }) {
    const expanded = expandedSymbol === item.name;
    const enriched = isEnriched(item);

    return (
      <TouchableOpacity
        style={[styles.symbolCard, expanded && styles.symbolCardExpanded]}
        onPress={() => toggleExpand(item.name)}
        activeOpacity={0.7}
      >
        <View style={styles.symbolHeader}>
          <View style={styles.symbolNameRow}>
            <Text style={styles.symbolName}>{item.name}</Text>
            {!enriched && (
              <View style={styles.basicBadge}>
                <Text style={styles.basicBadgeText}>Basic</Text>
              </View>
            )}
          </View>
          <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
        </View>

        {expanded && (
          <View style={styles.symbolDetails}>
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Meaning</Text>
              <Text style={styles.detailText}>{item.meaning}</Text>
            </View>

            {item.shadow_meaning && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Shadow</Text>
                <Text style={styles.detailShadow}>{item.shadow_meaning}</Text>
              </View>
            )}

            {item.guidance && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Guidance</Text>
                <Text style={styles.detailGuidance}>{item.guidance}</Text>
              </View>
            )}

            {item.category && (
              <Text style={styles.categoryTag}>{item.category}</Text>
            )}

            {item.related_symbols && item.related_symbols.length > 0 && (
              <View style={styles.relatedSection}>
                <Text style={styles.detailLabel}>Related Symbols</Text>
                <View style={styles.relatedRow}>
                  {item.related_symbols.map((rel, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.relatedPill}
                      onPress={() => {
                        setSearchQuery(rel);
                        setDebouncedQuery(rel);
                        setExpandedSymbol(null);
                      }}
                    >
                      <Text style={styles.relatedPillText}>{rel}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.gradient}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>Symbol Dictionary</Text>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search symbols..."
              placeholderTextColor="#6b5b8a"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => { setSearchQuery(''); setDebouncedQuery(''); }}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryRow}
            contentContainerStyle={styles.categoryRowContent}
          >
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.categoryChip, activeCategory === cat.value && styles.categoryChipActive]}
                onPress={() => handleCategoryPress(cat.value)}
              >
                <Text style={[styles.categoryChipText, activeCategory === cat.value && styles.categoryChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6b4e9e" />
          </View>
        ) : symbols.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📜</Text>
            <Text style={styles.emptyText}>No symbols found</Text>
            <Text style={styles.emptySubtext}>Try a different search or category</Text>
          </View>
        ) : (
          <FlatList
            data={symbols}
            renderItem={renderSymbol}
            keyExtractor={(item) => item.name}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator size="small" color="#6b4e9e" style={styles.footerLoader} />
              ) : null
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
  },
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0d4f7',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  categoryRow: {
    maxHeight: 40,
    marginBottom: 12,
  },
  categoryRowContent: {
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  categoryChipActive: {
    backgroundColor: '#3a3a6e',
    borderColor: '#9b7fd4',
  },
  categoryChipText: {
    color: '#8b7fa8',
    fontSize: 13,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#e0d4f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  footerLoader: {
    paddingVertical: 16,
  },
  symbolCard: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  symbolCardExpanded: {
    borderColor: '#6b4e9e',
  },
  symbolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbolNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  symbolName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0d4f7',
  },
  basicBadge: {
    backgroundColor: '#3a3a5e',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  basicBadgeText: {
    fontSize: 10,
    color: '#8b7fa8',
  },
  expandIcon: {
    color: '#8b7fa8',
    fontSize: 12,
  },
  symbolDetails: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#3a3a5e',
    paddingTop: 14,
  },
  detailSection: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9b7fd4',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#e8e0f8',
    lineHeight: 20,
  },
  detailShadow: {
    fontSize: 14,
    color: '#d8c8e8',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  detailGuidance: {
    fontSize: 14,
    color: '#c8f0d8',
    lineHeight: 20,
  },
  categoryTag: {
    fontSize: 12,
    color: '#8b7fa8',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  relatedSection: {
    marginTop: 4,
  },
  relatedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  relatedPill: {
    backgroundColor: '#3a3a5e',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  relatedPillText: {
    fontSize: 12,
    color: '#c4b8e8',
  },
});
