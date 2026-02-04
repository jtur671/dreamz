import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function HomeScreen({ navigation }: HomeScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.moonIcon}>{'\u{1F319}'}</Text>
          <Text style={styles.greeting}>Welcome, Dreamer</Text>
          <Text style={styles.subtitle}>What did you dream last night?</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.newDreamButton}
            onPress={() => navigation.navigate('NewDream')}
          >
            <Text style={styles.newDreamButtonText}>Record a Dream</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.grimoireButton}
            onPress={() => navigation.navigate('Grimoire')}
          >
            <Text style={styles.grimoireButtonText}>View Your Grimoire</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.tagline}>Your dreams are private. Always.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingTop: 48,
  },
  moonIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e0d4f7',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#a89cc8',
    textAlign: 'center',
  },
  actions: {
    gap: 16,
  },
  newDreamButton: {
    backgroundColor: '#6b4e9e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  newDreamButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  grimoireButton: {
    backgroundColor: '#2a2a4e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  grimoireButtonText: {
    color: '#e0d4f7',
    fontSize: 18,
    fontWeight: '600',
  },
  tagline: {
    color: '#5a5a7a',
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 24,
  },
});
