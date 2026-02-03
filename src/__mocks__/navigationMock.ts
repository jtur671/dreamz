/**
 * Mock Navigation for testing React Navigation components
 */

export const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  reset: jest.fn(),
  setParams: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
  canGoBack: jest.fn(() => true),
  getParent: jest.fn(),
  getState: jest.fn(() => ({
    routes: [],
    index: 0,
  })),
  isFocused: jest.fn(() => true),
};

export const mockRoute = {
  key: 'test-route-key',
  name: 'TestScreen',
  params: {},
};

export const createMockNavigation = (overrides: Partial<typeof mockNavigation> = {}) => ({
  ...mockNavigation,
  ...overrides,
});

export const createMockRoute = (name: string, params: Record<string, any> = {}) => ({
  key: `${name}-key`,
  name,
  params,
});

// Mock the entire @react-navigation/native module
export const mockReactNavigation = {
  useNavigation: jest.fn(() => mockNavigation),
  useRoute: jest.fn(() => mockRoute),
  useFocusEffect: jest.fn((callback: () => void) => callback()),
  useIsFocused: jest.fn(() => true),
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  createNavigationContainerRef: jest.fn(() => ({
    current: mockNavigation,
  })),
};
