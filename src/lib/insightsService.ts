import type { Dream } from '../types';

export interface FrequencyItem {
  name: string;
  count: number;
}

export interface RecurringSymbol {
  name: string;
  count: number;
  dreamIds: string[];
}

export interface WeeklyFrequency {
  week: string;
  count: number;
}

/**
 * Counts symbol frequency across all dreams
 */
export function getSymbolFrequency(dreams: Dream[]): FrequencyItem[] {
  const counts = new Map<string, number>();

  for (const dream of dreams) {
    if (!dream.reading?.symbols) continue;
    const seen = new Set<string>();
    for (const symbol of dream.reading.symbols) {
      const name = symbol.name;
      if (!seen.has(name)) {
        seen.add(name);
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Counts dream type distribution (dream vs nightmare)
 */
export function getDreamTypeDistribution(dreams: Dream[]): FrequencyItem[] {
  const counts = new Map<string, number>();
  for (const dream of dreams) {
    const type = dream.dream_type || 'dream';
    counts.set(type, (counts.get(type) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Counts dreams per week for the last 8 weeks
 */
export function getWeeklyFrequency(dreams: Dream[]): WeeklyFrequency[] {
  const now = new Date();
  const weeks: WeeklyFrequency[] = [];

  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const count = dreams.filter(d => {
      const created = new Date(d.created_at);
      return created >= weekStart && created < weekEnd;
    }).length;

    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    weeks.push({ week: label, count });
  }

  return weeks;
}

/**
 * Counts mood distribution across all dreams
 */
export function getMoodDistribution(dreams: Dream[]): FrequencyItem[] {
  const counts = new Map<string, number>();
  for (const dream of dreams) {
    if (dream.mood) {
      counts.set(dream.mood, (counts.get(dream.mood) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Finds symbols that recur in minCount or more dreams
 */
export function getRecurringSymbols(
  dreams: Dream[],
  minCount = 3
): RecurringSymbol[] {
  const symbolMap = new Map<string, string[]>();

  for (const dream of dreams) {
    if (!dream.reading?.symbols) continue;
    const seen = new Set<string>();
    for (const symbol of dream.reading.symbols) {
      const name = symbol.name;
      if (!seen.has(name)) {
        seen.add(name);
        const ids = symbolMap.get(name) || [];
        ids.push(dream.id);
        symbolMap.set(name, ids);
      }
    }
  }

  return Array.from(symbolMap.entries())
    .filter(([, ids]) => ids.length >= minCount)
    .map(([name, dreamIds]) => ({ name, count: dreamIds.length, dreamIds }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Computes streak and basic stats
 */
export function getDreamStats(dreams: Dream[]) {
  if (dreams.length === 0) {
    return { total: 0, streak: 0, thisWeek: 0, withReadings: 0 };
  }

  // Calculate streak
  const dates = [...new Set(
    dreams.map(d => {
      const dt = new Date(d.created_at);
      return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
    })
  )].map(key => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m, d);
  }).sort((a, b) => b.getTime() - a.getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let streak = 0;
  const first = new Date(dates[0]);
  first.setHours(0, 0, 0, 0);
  if (first.getTime() === today.getTime() || first.getTime() === yesterday.getTime()) {
    streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = dates[i - 1].getTime() - dates[i].getTime();
      if (diff === 86400000) {
        streak++;
      } else {
        break;
      }
    }
  }

  // This week count
  const startOfWeek = new Date(today);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const thisWeek = dreams.filter(d => new Date(d.created_at) >= startOfWeek).length;

  const withReadings = dreams.filter(d => !!d.reading).length;

  return { total: dreams.length, streak, thisWeek, withReadings };
}
