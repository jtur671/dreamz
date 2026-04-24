import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaperGrain } from '../components/PaperGrain';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { useDreams } from '../hooks/useDreams';
import {
  getSymbolFrequency,
  getDreamTypeDistribution,
  getWeeklyFrequency,
  getMoodDistribution,
  getRecurringSymbols,
  getDreamStats,
} from '../lib/insightsService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type InsightsScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const DONUT_COLORS = ['#C79A3A', '#C79A3A', '#C79A3A', '#C79A3A', '#5a3a8e', '#F0E8D8', '#7a5ab0'];
const BAR_COLOR = '#C79A3A';
const MIN_DREAMS_FOR_INSIGHTS = 5;

export default function InsightsScreen({ navigation }: InsightsScreenProps) {
  const { contentStyle, screenWidth } = useResponsiveLayout();
  const chartWidth = Math.min(screenWidth, 600) - 48 - 40 - 45;
  const { dreams, loading } = useDreams();

  const stats = useMemo(() => getDreamStats(dreams), [dreams]);
  const symbolFreq = useMemo(() => getSymbolFrequency(dreams), [dreams]);
  const dreamTypes = useMemo(() => getDreamTypeDistribution(dreams), [dreams]);
  const weeklyFreq = useMemo(() => getWeeklyFrequency(dreams), [dreams]);
  const moods = useMemo(() => getMoodDistribution(dreams), [dreams]);
  const recurring = useMemo(() => getRecurringSymbols(dreams), [dreams]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#C79A3A" />
      </View>
    );
  }

  if (dreams.length < MIN_DREAMS_FOR_INSIGHTS) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <PaperGrain /><View style={styles.gradient}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✧</Text>
            <Text style={styles.emptyTitle}>Your Insights Await</Text>
            <Text style={styles.emptyText}>
              Record at least {MIN_DREAMS_FOR_INSIGHTS} dreams to unlock patterns and insights about your dream life.
            </Text>
            <Text style={styles.emptyCount}>
              {dreams.length} of {MIN_DREAMS_FOR_INSIGHTS} dreams recorded
            </Text>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => navigation.navigate('NewDream')}
              accessibilityRole="button"
              accessibilityLabel="Record a Dream"
            >
              <Text style={styles.ctaButtonText}>Record a Dream</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Prepare chart data
  const topSymbolsData = symbolFreq.slice(0, 6).map((item, i) => ({
    value: item.count,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
    text: item.name,
  }));

  const dreamTypeData = dreamTypes.map((item, i) => ({
    value: item.count,
    color: item.name === 'nightmare' ? '#B23A3A' : DONUT_COLORS[i % DONUT_COLORS.length],
    text: item.name,
  }));

  const weeklyBarData = weeklyFreq.map(item => ({
    value: item.count,
    label: item.week,
    frontColor: BAR_COLOR,
  }));

  const maxMoodCount = moods.length > 0 ? moods[0].count : 1;

  function navigateToDictionary(symbolName: string) {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Dictionary',
        params: { search: symbolName },
      })
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <PaperGrain /><View style={styles.gradient}>
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Dream Insights</Text>
          <Text style={styles.subtitle}>Patterns from your dream journal</Text>

          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>Dreams</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.streak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.thisWeek}</Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
          </View>

          {/* Weekly Frequency */}
          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Weekly Activity</Text>
            <View style={styles.chartContainer}>
              <BarChart
                data={weeklyBarData}
                width={chartWidth}
                barWidth={Math.floor(chartWidth / 8 - 10)}
                spacing={10}
                xAxisColor="#5C3A69"
                yAxisColor="#5C3A69"
                xAxisLabelTextStyle={styles.chartAxisLabel}
                yAxisTextStyle={styles.chartAxisLabel}
                noOfSections={4}
                barBorderRadius={4}
                isAnimated
                backgroundColor="transparent"
              />
            </View>
          </View>

          {/* Dream Types Donut */}
          {dreamTypeData.length > 1 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>Dream Types</Text>
              <View style={styles.donutRow}>
                <PieChart
                  data={dreamTypeData}
                  donut
                  radius={70}
                  innerRadius={45}
                  innerCircleColor="#3B1F47"
                  centerLabelComponent={() => (
                    <Text style={styles.donutCenter}>{stats.total}</Text>
                  )}
                />
                <View style={styles.legendContainer}>
                  {dreamTypeData.map((item, i) => (
                    <View key={i} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendText}>
                        {item.text.charAt(0).toUpperCase() + item.text.slice(1)} ({item.value})
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Top Symbols Donut */}
          {topSymbolsData.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>Top Symbols</Text>
              <View style={styles.donutRow}>
                <PieChart
                  data={topSymbolsData}
                  donut
                  radius={70}
                  innerRadius={45}
                  innerCircleColor="#3B1F47"
                />
                <View style={styles.legendContainer}>
                  {topSymbolsData.map((item, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.legendItem}
                      onPress={() => navigateToDictionary(item.text)}
                      accessibilityRole="button"
                      accessibilityLabel={`Look up ${item.text} in dictionary`}
                    >
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.legendText, styles.legendTextLink]}>
                        {item.text} ({item.value})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Mood Distribution */}
          {moods.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>Mood Distribution</Text>
              <View style={styles.moodList}>
                {moods.slice(0, 8).map((item, i) => (
                  <View key={i} style={styles.moodItem}>
                    <Text style={styles.moodName}>{item.name}</Text>
                    <View style={styles.moodBarTrack}>
                      <View
                        style={[
                          styles.moodBarFill,
                          { width: `${(item.count / maxMoodCount) * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.moodCount}>{item.count}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Recurring Symbols */}
          {recurring.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionTitle}>Recurring Symbols</Text>
              <Text style={styles.sectionSubtitle}>Symbols appearing in 3+ dreams</Text>
              {recurring.slice(0, 10).map((item, i) => (
                <View key={i} style={styles.recurringItem}>
                  <TouchableOpacity
                    onPress={() => navigateToDictionary(item.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Look up ${item.name} in dictionary`}
                  >
                    <Text style={[styles.recurringName, styles.legendTextLink]}>{item.name}</Text>
                  </TouchableOpacity>
                  <View style={styles.recurringBarTrack}>
                    <View
                      style={[
                        styles.recurringBarFill,
                        { width: `${Math.min(100, (item.count / stats.total) * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.recurringCount}>{item.count}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#3B1F47',
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#3B1F47',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F0E8D8',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8F8877',
    marginBottom: 20,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#C79A3A',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F0E8D8',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#8F8877',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  emptyCount: {
    fontSize: 14,
    color: '#C79A3A',
    fontWeight: '600',
    marginBottom: 24,
  },
  ctaButton: {
    backgroundColor: '#C79A3A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#4B2B58',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5C3A69',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F0E8D8',
  },
  statLabel: {
    fontSize: 12,
    color: '#8F8877',
    marginTop: 4,
    fontWeight: '500',
  },
  // Chart sections
  chartSection: {
    backgroundColor: '#4B2B58',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#5C3A69',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F0E8D8',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#8F8877',
    marginBottom: 16,
  },
  chartContainer: {
    marginTop: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  chartAxisLabel: {
    color: '#8F8877',
    fontSize: 10,
  },
  // Donut chart layout
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 20,
  },
  donutCenter: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F0E8D8',
  },
  legendContainer: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
    color: '#C9C0AE',
  },
  legendTextLink: {
    textDecorationLine: 'underline',
    textDecorationColor: '#C79A3A',
  },
  // Mood distribution
  moodList: {
    marginTop: 12,
    gap: 10,
  },
  moodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moodName: {
    width: 80,
    fontSize: 13,
    color: '#C9C0AE',
    fontWeight: '500',
  },
  moodBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#3B1F47',
    borderRadius: 4,
    overflow: 'hidden',
  },
  moodBarFill: {
    height: '100%',
    backgroundColor: '#C79A3A',
    borderRadius: 4,
  },
  moodCount: {
    width: 24,
    fontSize: 13,
    color: '#8F8877',
    textAlign: 'right',
  },
  // Recurring symbols
  recurringItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  recurringName: {
    width: 80,
    fontSize: 13,
    color: '#C9C0AE',
    fontWeight: '500',
  },
  recurringBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#3B1F47',
    borderRadius: 4,
    overflow: 'hidden',
  },
  recurringBarFill: {
    height: '100%',
    backgroundColor: '#C79A3A',
    borderRadius: 4,
  },
  recurringCount: {
    width: 24,
    fontSize: 13,
    color: '#8F8877',
    textAlign: 'right',
  },
});
