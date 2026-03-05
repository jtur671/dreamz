// Load .env so test helpers (e.g. resetTestReadingLimit) can access Supabase vars
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.ts'],
  testTimeout: 300000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: [
    'detox/runners/jest/reporter',
    ['jest-html-reporters', {
      publicPath: './e2e/reports',
      filename: 'qa-dashboard.html',
      pageTitle: 'Dreamz QA Dashboard',
      expand: true,
      includeFailureMsg: true,
    }],
  ],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  verbose: true,
};
