/**
 * Tests for Supabase client
 * @file src/lib/__tests__/supabase.test.ts
 */

import { supabase } from '../supabase';

describe('Supabase Client', () => {
  it('should export a supabase client instance', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
  });

  it('should have auth methods available', () => {
    expect(supabase.auth.getUser).toBeDefined();
    expect(supabase.auth.getSession).toBeDefined();
    expect(supabase.auth.signInWithPassword).toBeDefined();
    expect(supabase.auth.signUp).toBeDefined();
    expect(supabase.auth.signOut).toBeDefined();
  });

  it('should have database query method available', () => {
    expect(supabase.from).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });

  it('should call auth.getUser correctly', async () => {
    const result = await supabase.auth.getUser();
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
  });

  it('should call auth.getSession correctly', async () => {
    const result = await supabase.auth.getSession();
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
  });
});
