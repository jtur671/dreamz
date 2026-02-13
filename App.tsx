import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';

import AuthScreen, { setOnNewUserSignup } from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import NewDreamScreen from './src/screens/NewDreamScreen';
import GrimoireScreen from './src/screens/GrimoireScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import DictionaryScreen from './src/screens/DictionaryScreen';
import ReadingScreen from './src/screens/ReadingScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { DreamProvider } from './src/context/DreamContext';
import { getProfile } from './src/lib/profileService';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab icon component
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '☽',
    Grimoire: '📖',
    Insights: '✧',
    Dictionary: '📜',
    Settings: '⚙',
  };

  return (
    <View style={[styles.tabIconContainer, focused && styles.tabIconContainerFocused]}>
      <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>
        {icons[name] || '•'}
      </Text>
    </View>
  );
}

// Main tabs navigator
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <DreamProvider>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            ...styles.tabBar,
            paddingBottom: Math.max(insets.bottom, 8),
            height: 62 + Math.max(insets.bottom, 8),
          },
          tabBarActiveTintColor: '#e0d4f7',
          tabBarInactiveTintColor: '#6b5b8a',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={route.name} focused={focused} />
          ),
          tabBarLabelStyle: styles.tabLabel,
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarLabel: 'Dream' }}
        />
        <Tab.Screen
          name="Grimoire"
          component={GrimoireScreen}
          options={{ tabBarLabel: 'Grimoire' }}
        />
        <Tab.Screen
          name="Insights"
          component={InsightsScreen}
          options={{ tabBarLabel: 'Insights' }}
        />
        <Tab.Screen
          name="Dictionary"
          component={DictionaryScreen}
          options={{ tabBarLabel: 'Dictionary' }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarLabel: 'Settings' }}
        />
      </Tab.Navigator>
    </DreamProvider>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Set up callback for new user signup
    setOnNewUserSignup(() => {
      setNeedsOnboarding(true);
    });

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);

      // Check if user needs onboarding
      if (session) {
        const profile = await getProfile();
        // Only show onboarding if explicitly false (new users)
        // Existing users with null or true skip onboarding
        if (profile?.onboarding_completed === false) {
          setNeedsOnboarding(true);
        }
      }

      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);

        // Reset onboarding state on sign out
        if (!session) {
          setNeedsOnboarding(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      setOnNewUserSignup(null);
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6b4e9e" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        {session ? (
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#1a1a2e' },
            }}
          >
            {needsOnboarding ? (
              <Stack.Screen
                name="Onboarding"
                component={OnboardingScreen}
                listeners={{
                  beforeRemove: () => {
                    // When leaving onboarding, mark as complete
                    setNeedsOnboarding(false);
                  },
                }}
              />
            ) : null}
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="NewDream" component={NewDreamScreen} />
            <Stack.Screen name="Reading" component={ReadingScreen} />
          </Stack.Navigator>
        ) : (
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#1a1a2e' },
            }}
          >
            <Stack.Screen name="Auth" component={AuthScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    backgroundColor: '#1a1a2e',
    borderTopColor: '#2a2a4e',
    borderTopWidth: 1,
    paddingTop: 8,
    // paddingBottom and height are set dynamically based on safe area insets
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  tabIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  tabIconContainerFocused: {
    backgroundColor: 'rgba(107,78,158,0.15)',
  },
  tabIcon: {
    fontSize: 24,
    color: '#6b5b8a',
  },
  tabIconFocused: {
    color: '#e0d4f7',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 4,
  },
});
