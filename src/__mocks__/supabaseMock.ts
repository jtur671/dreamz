/**
 * Mock Supabase client for testing
 */

export const mockUser = {
  id: 'test-user-id-123',
  email: 'test@dreamz.app',
  created_at: '2024-01-01T00:00:00.000Z',
};

export const mockSession = {
  access_token: 'mock-access-token-xyz',
  refresh_token: 'mock-refresh-token',
  user: mockUser,
  expires_at: Date.now() / 1000 + 3600,
};

export const mockDream = {
  id: 'dream-id-123',
  user_id: mockUser.id,
  dream_text: 'I was flying over a purple forest',
  mood: 'Peaceful',
  reading: null,
  created_at: '2024-01-15T08:00:00.000Z',
  updated_at: '2024-01-15T08:00:00.000Z',
};

export const mockReading = {
  title: 'The Flight Through Enchanted Woods',
  tldr: 'A dream of freedom and spiritual awakening through nature.',
  symbols: [
    {
      name: 'Flying',
      meaning: 'Represents freedom, transcendence, and liberation from earthly concerns.',
      shadow: 'May indicate escapism or avoiding grounded responsibilities.',
      guidance: 'Embrace your aspirations while staying connected to your foundation.',
    },
    {
      name: 'Purple Forest',
      meaning: 'Symbolizes intuition, mystery, and spiritual transformation.',
      shadow: 'Could represent confusion or feeling lost in the unknown.',
      guidance: 'Trust your inner wisdom as you navigate unfamiliar territory.',
    },
    {
      name: 'Height',
      meaning: 'Perspective, overview, rising above challenges.',
      shadow: 'Detachment from emotions or others.',
      guidance: 'Use your elevated view to gain clarity, then return to engage.',
    },
  ],
  omen: 'The convergence of flight and mystical forest suggests a period of spiritual growth is approaching.',
  ritual: 'Light a purple candle and meditate on the feeling of freedom from your dream for 5 minutes.',
  journal_prompt: 'What areas of your life are calling for you to rise above and see from a new perspective?',
  tags: ['freedom', 'transformation', 'nature', 'spirituality'],
};

// Mock query builder for Supabase
const createMockQueryBuilder = (returnData: any = null, returnError: any = null) => {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: returnData, error: returnError }),
    then: (resolve: any) => resolve({ data: returnData, error: returnError }),
  };
  return builder;
};

export const createMockSupabase = (overrides: any = {}) => {
  const defaultMock = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null }),
      signUp: jest.fn().mockResolvedValue({ data: { user: mockUser, session: null }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
    from: jest.fn((table: string) => createMockQueryBuilder(mockDream, null)),
  };

  return {
    ...defaultMock,
    ...overrides,
  };
};

export const mockSupabase = createMockSupabase();
