import { supabase } from './supabase';

export interface Symbol {
  name: string;
  meaning: string;
  shadow_meaning: string | null;
  guidance: string | null;
  category: string | null;
  related_symbols: string[] | null;
  source: string | null;
}

export type SortPhase = 'alpha' | 'numeric';

/**
 * Escapes SQL LIKE/ILIKE wildcard characters in user input
 */
function escapeLikeQuery(query: string): string {
  return query.replace(/[%_\\]/g, '\\$&');
}

/**
 * Search symbols by name (case-insensitive partial match)
 */
export async function searchSymbols(
  query: string,
  limit = 50,
  offset = 0,
  phase: SortPhase = 'alpha'
): Promise<{ data: Symbol[]; error: string | null }> {
  const escaped = escapeLikeQuery(query);
  let q = supabase
    .from('symbols')
    .select('name, meaning, shadow_meaning, guidance, category, related_symbols, source')
    .ilike('name', `%${escaped}%`);

  q = phase === 'alpha' ? q.gte('name', 'A') : q.lt('name', 'A');

  const { data, error } = await q
    .order('name')
    .range(offset, offset + limit - 1);

  if (error) return { data: [], error: error.message };
  return { data: data as Symbol[], error: null };
}

/**
 * Fetch symbols starting with a given letter
 */
export async function fetchSymbolsByLetter(
  letter: string,
  limit = 50,
  offset = 0
): Promise<{ data: Symbol[]; error: string | null }> {
  const { data, error } = await supabase
    .from('symbols')
    .select('name, meaning, shadow_meaning, guidance, category, related_symbols, source')
    .ilike('name', `${letter}%`)
    .order('name')
    .range(offset, offset + limit - 1);

  if (error) return { data: [], error: error.message };
  return { data: data as Symbol[], error: null };
}

/**
 * Fetch a single symbol by exact name
 */
export async function fetchSymbolByName(
  name: string
): Promise<{ data: Symbol | null; error: string | null }> {
  const { data, error } = await supabase
    .from('symbols')
    .select('name, meaning, shadow_meaning, guidance, category, related_symbols, source')
    .eq('name', name)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Symbol, error: null };
}

/**
 * Fetch symbols by category
 */
export async function fetchSymbolsByCategory(
  category: string,
  limit = 50,
  offset = 0,
  phase: SortPhase = 'alpha'
): Promise<{ data: Symbol[]; error: string | null }> {
  let q = supabase
    .from('symbols')
    .select('name, meaning, shadow_meaning, guidance, category, related_symbols, source')
    .eq('category', category);

  q = phase === 'alpha' ? q.gte('name', 'A') : q.lt('name', 'A');

  const { data, error } = await q
    .order('name')
    .range(offset, offset + limit - 1);

  if (error) return { data: [], error: error.message };
  return { data: data as Symbol[], error: null };
}

/**
 * Fetch distinct categories
 */
export async function fetchCategories(): Promise<{ data: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from('symbols')
    .select('category')
    .not('category', 'is', null)
    .order('category');

  if (error) return { data: [], error: error.message };

  // Deduplicate
  const categories = [...new Set((data as { category: string }[]).map(r => r.category))];
  return { data: categories, error: null };
}

/**
 * Fetch all symbols with pagination (alphabetical browse, letters before numbers)
 */
export async function fetchSymbols(
  limit = 50,
  offset = 0,
  phase: SortPhase = 'alpha'
): Promise<{ data: Symbol[]; error: string | null }> {
  let q = supabase
    .from('symbols')
    .select('name, meaning, shadow_meaning, guidance, category, related_symbols, source');

  q = phase === 'alpha' ? q.gte('name', 'A') : q.lt('name', 'A');

  const { data, error } = await q
    .order('name')
    .range(offset, offset + limit - 1);

  if (error) return { data: [], error: error.message };
  return { data: data as Symbol[], error: null };
}
