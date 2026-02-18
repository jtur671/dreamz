/** @type {import('detox').DetoxConfig} */
module.exports = {
  testRunner: {
    args: { $0: 'jest', config: 'e2e/jest.config.js' },
    jest: { setupTimeout: 120000 },
  },
  apps: {
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/Dreamz.app',
      build:
        'xcodebuild -workspace ios/Dreamz.xcworkspace -scheme Dreamz -configuration Release -sdk iphonesimulator -derivedDataPath ios/build -destination "platform=iOS Simulator,name=iPhone 16 Pro,OS=26.2"',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 16 Pro', os: 'iOS 26.2' },
    },
  },
  configurations: {
    'ios.release': {
      device: 'simulator',
      app: 'ios.release',
    },
  },
  artifacts: {
    rootDir: './e2e/artifacts',
    plugins: {
      screenshot: {
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: true,
        takeWhen: { testDone: true },
      },
      log: { enabled: true },
    },
  },
};
