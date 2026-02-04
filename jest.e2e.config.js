/**
 * Jest configuration for E2E tests
 *
 * E2E tests run against real Supabase backend and need real fetch.
 */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/*.e2e.test.ts'],
  // No setup file - we want real fetch, real env vars
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Run tests serially to avoid race conditions
  maxWorkers: 1,
  // Longer timeout for network operations
  testTimeout: 30000,
};
