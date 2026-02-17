import { registerRootComponent } from 'expo';
import { NativeModules } from 'react-native';

import App from './App';

// Detox session injection: auto-login when launch args provide test credentials.
// Only runs in release builds (Detox tests use Release configuration).
if (__DEV__ === false) {
  const launchArgs = NativeModules.LaunchArguments?.value || {};
  if (launchArgs.detoxTestEmail && launchArgs.detoxTestPassword) {
    const { supabase } = require('./src/lib/supabase');
    supabase.auth.signInWithPassword({
      email: launchArgs.detoxTestEmail,
      password: launchArgs.detoxTestPassword,
    });
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
