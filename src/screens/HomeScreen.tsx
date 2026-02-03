import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function HomeScreen({ navigation }: HomeScreenProps) {
  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Welcome, Dreamer</Text>
      <Text style={styles.subtitle}>What did you dream last night?</Text>

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
        <Text style={styles.grimoireButtonText}>View Grimoire</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  greeting: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e0d4f7',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#a89cc8',
    marginBottom: 48,
  },
  newDreamButton: {
    backgroundColor: '#6b4e9e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
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
  signOutButton: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  signOutText: {
    color: '#8b7fa8',
    fontSize: 14,
  },
});
