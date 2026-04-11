import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';

interface AIConsentModalProps {
  visible: boolean;
  onAllow: () => void;
  onDecline: () => void;
}

export default function AIConsentModal({ visible, onAllow, onDecline }: AIConsentModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      accessibilityViewIsModal={true}
    >
      <View testID="ai-consent-modal" style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Before We Read Your Dream</Text>

          <Text style={styles.body}>
            To interpret your dream, we send the following to OpenAI:
          </Text>

          <View style={styles.dataList}>
            <Text style={styles.dataItem}>Your dream text</Text>
            <Text style={styles.dataItem}>Your selected mood</Text>
            <Text style={styles.dataItem}>
              Profile details you've shared (zodiac sign, gender, age range)
            </Text>
          </View>

          <Text style={styles.body}>
            Your data is processed solely for generating your reading and is not
            used to train AI models.
          </Text>

          <TouchableOpacity
            testID="ai-consent-privacy-link"
            onPress={() => Linking.openURL('https://dreamz-journal.com/privacy.html')}
            accessibilityRole="link"
            accessibilityLabel="Read our Privacy Policy"
          >
            <Text style={styles.privacyLink}>Read our Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="ai-consent-allow"
            style={styles.allowButton}
            onPress={onAllow}
            accessibilityRole="button"
            accessibilityLabel="Allow Dream Readings"
          >
            <Text style={styles.allowButtonText}>Allow Dream Readings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="ai-consent-decline"
            style={styles.declineButton}
            onPress={onDecline}
            accessibilityRole="button"
            accessibilityLabel="Not Now"
          >
            <Text style={styles.declineButtonText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e0d4f7',
    textAlign: 'center',
    marginBottom: 20,
  },
  body: {
    fontSize: 15,
    color: '#c0b4e0',
    lineHeight: 22,
    marginBottom: 12,
  },
  dataList: {
    backgroundColor: '#2a2a4e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3a3a5e',
  },
  dataItem: {
    fontSize: 14,
    color: '#e0d4f7',
    lineHeight: 22,
    paddingLeft: 8,
  },
  privacyLink: {
    color: '#9b7fd4',
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginBottom: 24,
  },
  allowButton: {
    backgroundColor: '#6b4e9e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  allowButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  declineButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#8b7fa8',
    fontSize: 16,
  },
});
