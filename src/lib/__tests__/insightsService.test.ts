/**
 * Tests for Insights Service functions
 * @file src/lib/__tests__/insightsService.test.ts
 *
 * Covers: getIndividualMoodFrequency, getSymbolFrequency, getMoodDistribution,
 *         getDreamStats, getRecurringSymbols, getDreamTypeDistribution, getWeeklyFrequency
 */

import {
  getIndividualMoodFrequency,
  getSymbolFrequency,
  getMoodDistribution,
  getDreamStats,
  getRecurringSymbols,
  getDreamTypeDistribution,
  getWeeklyFrequency,
} from '../insightsService';
import type { Dream } from '../../types';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeDream(overrides: Partial<Dream> = {}): Dream {
  return {
    id: overrides.id ?? `dream-${Math.random().toString(36).slice(2, 8)}`,
    user_id: 'user-1',
    dream_text: 'test dream',
    mood: overrides.mood ?? undefined,
    reading: overrides.reading ?? undefined,
    dream_type: overrides.dream_type ?? 'dream',
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

function makeSymbol(name: string) {
  return { name, meaning: 'm', shadow: 's', guidance: 'g' };
}

// ---------------------------------------------------------------------------
// getIndividualMoodFrequency
// ---------------------------------------------------------------------------

describe('getIndividualMoodFrequency', () => {
  it('splits comma-separated moods into separate counts', () => {
    const dreams = [
      makeDream({ mood: 'Peaceful, Curious' }),
      makeDream({ mood: 'Peaceful, Inspired' }),
    ];
    const result = getIndividualMoodFrequency(dreams);
    expect(result.find((r) => r.name === 'Peaceful')?.count).toBe(2);
    expect(result.find((r) => r.name === 'Curious')?.count).toBe(1);
    expect(result.find((r) => r.name === 'Inspired')?.count).toBe(1);
  });

  it('counts across multiple dreams', () => {
    const dreams = [
      makeDream({ mood: 'Vivid' }),
      makeDream({ mood: 'Vivid, Surreal' }),
      makeDream({ mood: 'Surreal' }),
    ];
    const result = getIndividualMoodFrequency(dreams);
    expect(result[0]).toEqual({ name: 'Vivid', count: 2 });
    expect(result[1]).toEqual({ name: 'Surreal', count: 2 });
  });

  it('handles empty mood string', () => {
    const dreams = [makeDream({ mood: '' })];
    expect(getIndividualMoodFrequency(dreams)).toEqual([]);
  });

  it('handles undefined mood', () => {
    const dreams = [makeDream({ mood: undefined })];
    expect(getIndividualMoodFrequency(dreams)).toEqual([]);
  });

  it('handles empty dreams array', () => {
    expect(getIndividualMoodFrequency([])).toEqual([]);
  });

  it('handles single-tag moods (no comma)', () => {
    const dreams = [makeDream({ mood: 'Joyful' })];
    const result = getIndividualMoodFrequency(dreams);
    expect(result).toEqual([{ name: 'Joyful', count: 1 }]);
  });

  it('sorts by frequency descending', () => {
    const dreams = [
      makeDream({ mood: 'A, B, C' }),
      makeDream({ mood: 'B, C' }),
      makeDream({ mood: 'C' }),
    ];
    const result = getIndividualMoodFrequency(dreams);
    expect(result.map((r) => r.name)).toEqual(['C', 'B', 'A']);
    expect(result.map((r) => r.count)).toEqual([3, 2, 1]);
  });

  it('trims whitespace around mood tags', () => {
    const dreams = [makeDream({ mood: '  Peaceful , Curious  ' })];
    const result = getIndividualMoodFrequency(dreams);
    expect(result.map((r) => r.name)).toEqual(['Peaceful', 'Curious']);
  });
});

// ---------------------------------------------------------------------------
// getSymbolFrequency
// ---------------------------------------------------------------------------

describe('getSymbolFrequency', () => {
  it('counts symbols across dreams', () => {
    const dreams = [
      makeDream({ reading: { title: '', tldr: '', symbols: [makeSymbol('Moon'), makeSymbol('Water')], omen: '', ritual: '', journal_prompt: '', tags: [] } }),
      makeDream({ reading: { title: '', tldr: '', symbols: [makeSymbol('Moon')], omen: '', ritual: '', journal_prompt: '', tags: [] } }),
    ];
    const result = getSymbolFrequency(dreams);
    expect(result[0]).toEqual({ name: 'Moon', count: 2 });
    expect(result[1]).toEqual({ name: 'Water', count: 1 });
  });

  it('deduplicates within same dream (case-insensitive)', () => {
    const dreams = [
      makeDream({ reading: { title: '', tldr: '', symbols: [makeSymbol('Moon'), makeSymbol('moon')], omen: '', ritual: '', journal_prompt: '', tags: [] } }),
    ];
    const result = getSymbolFrequency(dreams);
    expect(result).toEqual([{ name: 'Moon', count: 1 }]);
  });

  it('handles dreams with no reading', () => {
    const dreams = [makeDream({ reading: undefined })];
    expect(getSymbolFrequency(dreams)).toEqual([]);
  });

  it('handles empty array', () => {
    expect(getSymbolFrequency([])).toEqual([]);
  });

  it('capitalizes first letter of symbol name', () => {
    const dreams = [
      makeDream({ reading: { title: '', tldr: '', symbols: [makeSymbol('black cat')], omen: '', ritual: '', journal_prompt: '', tags: [] } }),
    ];
    const result = getSymbolFrequency(dreams);
    expect(result[0].name).toBe('Black cat');
  });
});

// ---------------------------------------------------------------------------
// getMoodDistribution
// ---------------------------------------------------------------------------

describe('getMoodDistribution', () => {
  it('counts full mood strings', () => {
    const dreams = [
      makeDream({ mood: 'Peaceful, Curious' }),
      makeDream({ mood: 'Peaceful, Curious' }),
      makeDream({ mood: 'Vivid' }),
    ];
    const result = getMoodDistribution(dreams);
    expect(result[0]).toEqual({ name: 'Peaceful, Curious', count: 2 });
    expect(result[1]).toEqual({ name: 'Vivid', count: 1 });
  });

  it('handles empty array', () => {
    expect(getMoodDistribution([])).toEqual([]);
  });

  it('skips dreams without mood', () => {
    const dreams = [makeDream({ mood: undefined }), makeDream({ mood: 'Vivid' })];
    expect(getMoodDistribution(dreams)).toEqual([{ name: 'Vivid', count: 1 }]);
  });
});

// ---------------------------------------------------------------------------
// getDreamStats
// ---------------------------------------------------------------------------

describe('getDreamStats', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns zeros for empty array', () => {
    expect(getDreamStats([])).toEqual({ total: 0, streak: 0, thisWeek: 0, withReadings: 0 });
  });

  it('computes streak for consecutive days including today', () => {
    jest.setSystemTime(new Date('2026-03-18T12:00:00Z'));
    const dreams = [
      makeDream({ created_at: '2026-03-18T08:00:00Z' }),
      makeDream({ created_at: '2026-03-17T08:00:00Z' }),
      makeDream({ created_at: '2026-03-16T08:00:00Z' }),
    ];
    const stats = getDreamStats(dreams);
    expect(stats.streak).toBe(3);
  });

  it('streak starts from yesterday if no dream today', () => {
    jest.setSystemTime(new Date('2026-03-18T12:00:00Z'));
    const dreams = [
      makeDream({ created_at: '2026-03-17T08:00:00Z' }),
      makeDream({ created_at: '2026-03-16T08:00:00Z' }),
    ];
    const stats = getDreamStats(dreams);
    expect(stats.streak).toBe(2);
  });

  it('streak breaks on gap day', () => {
    jest.setSystemTime(new Date('2026-03-18T12:00:00Z'));
    const dreams = [
      makeDream({ created_at: '2026-03-18T08:00:00Z' }),
      // gap on 2026-03-17
      makeDream({ created_at: '2026-03-16T08:00:00Z' }),
    ];
    const stats = getDreamStats(dreams);
    expect(stats.streak).toBe(1);
  });

  it('streak is 0 if most recent dream is older than yesterday', () => {
    jest.setSystemTime(new Date('2026-03-18T12:00:00Z'));
    const dreams = [
      makeDream({ created_at: '2026-03-15T08:00:00Z' }),
    ];
    const stats = getDreamStats(dreams);
    expect(stats.streak).toBe(0);
  });

  it('thisWeek count is correct', () => {
    // Set to a Wednesday
    jest.setSystemTime(new Date('2026-03-18T12:00:00Z')); // Wednesday
    // Start of week (Sunday) = Mar 15
    const dreams = [
      makeDream({ created_at: '2026-03-18T08:00:00Z' }), // this week
      makeDream({ created_at: '2026-03-15T08:00:00Z' }), // this week (Sunday)
      makeDream({ created_at: '2026-03-14T08:00:00Z' }), // last week (Saturday)
    ];
    const stats = getDreamStats(dreams);
    expect(stats.thisWeek).toBe(2);
  });

  it('counts total and withReadings correctly', () => {
    jest.setSystemTime(new Date('2026-03-18T12:00:00Z'));
    const dreams = [
      makeDream({ created_at: '2026-03-18T08:00:00Z', reading: { title: 't', tldr: '', symbols: [], omen: '', ritual: '', journal_prompt: '', tags: [] } }),
      makeDream({ created_at: '2026-03-17T08:00:00Z', reading: undefined }),
    ];
    const stats = getDreamStats(dreams);
    expect(stats.total).toBe(2);
    expect(stats.withReadings).toBe(1);
  });

  it('handles multiple dreams on same day for streak', () => {
    jest.setSystemTime(new Date('2026-03-18T12:00:00Z'));
    const dreams = [
      makeDream({ created_at: '2026-03-18T08:00:00Z' }),
      makeDream({ created_at: '2026-03-18T20:00:00Z' }),
      makeDream({ created_at: '2026-03-17T08:00:00Z' }),
    ];
    const stats = getDreamStats(dreams);
    expect(stats.streak).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getRecurringSymbols
// ---------------------------------------------------------------------------

describe('getRecurringSymbols', () => {
  const makeReadingDream = (id: string, symbolNames: string[]) =>
    makeDream({
      id,
      reading: {
        title: '',
        tldr: '',
        symbols: symbolNames.map(makeSymbol),
        omen: '',
        ritual: '',
        journal_prompt: '',
        tags: [],
      },
    });

  it('finds symbols in 3+ dreams', () => {
    const dreams = [
      makeReadingDream('d1', ['Moon', 'Water']),
      makeReadingDream('d2', ['Moon', 'Fire']),
      makeReadingDream('d3', ['Moon', 'Water']),
      makeReadingDream('d4', ['Water']),
    ];
    const result = getRecurringSymbols(dreams);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Moon');
    expect(result[0].count).toBe(3);
    expect(result[1].name).toBe('Water');
    expect(result[1].count).toBe(3);
  });

  it('respects minCount parameter', () => {
    const dreams = [
      makeReadingDream('d1', ['Moon']),
      makeReadingDream('d2', ['Moon']),
    ];
    const result = getRecurringSymbols(dreams, 2);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Moon');
    expect(result[0].count).toBe(2);
  });

  it('deduplicates within same dream (case-insensitive)', () => {
    const dreams = [
      makeReadingDream('d1', ['Moon', 'moon']),
      makeReadingDream('d2', ['Moon']),
      makeReadingDream('d3', ['moon']),
    ];
    const result = getRecurringSymbols(dreams);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
    expect(result[0].dreamIds).toEqual(['d1', 'd2', 'd3']);
  });

  it('returns empty for dreams without readings', () => {
    const dreams = [makeDream(), makeDream(), makeDream()];
    expect(getRecurringSymbols(dreams)).toEqual([]);
  });

  it('returns empty when no symbol meets threshold', () => {
    const dreams = [
      makeReadingDream('d1', ['Moon']),
      makeReadingDream('d2', ['Water']),
    ];
    expect(getRecurringSymbols(dreams)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDreamTypeDistribution
// ---------------------------------------------------------------------------

describe('getDreamTypeDistribution', () => {
  it('counts dream types', () => {
    const dreams = [
      makeDream({ dream_type: 'dream' }),
      makeDream({ dream_type: 'dream' }),
      makeDream({ dream_type: 'nightmare' }),
    ];
    const result = getDreamTypeDistribution(dreams);
    expect(result).toEqual([
      { name: 'dream', count: 2 },
      { name: 'nightmare', count: 1 },
    ]);
  });

  it('defaults to dream when dream_type is falsy', () => {
    const dreams = [makeDream({ dream_type: undefined as any })];
    const result = getDreamTypeDistribution(dreams);
    expect(result).toEqual([{ name: 'dream', count: 1 }]);
  });

  it('handles empty array', () => {
    expect(getDreamTypeDistribution([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getWeeklyFrequency
// ---------------------------------------------------------------------------

describe('getWeeklyFrequency', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 8 weeks of data', () => {
    jest.setSystemTime(new Date('2026-03-18T12:00:00Z'));
    const result = getWeeklyFrequency([]);
    expect(result).toHaveLength(8);
  });

  it('counts dreams in the correct week', () => {
    jest.setSystemTime(new Date('2026-03-18T12:00:00Z'));
    const dreams = [
      makeDream({ created_at: '2026-03-18T08:00:00Z' }),
      makeDream({ created_at: '2026-03-17T08:00:00Z' }),
    ];
    const result = getWeeklyFrequency(dreams);
    // Last element should include this week's dreams
    const lastWeek = result[result.length - 1];
    expect(lastWeek.count).toBeGreaterThanOrEqual(1);
  });
});
