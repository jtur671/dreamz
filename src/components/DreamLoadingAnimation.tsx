import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const SAVING_MESSAGES = [
  'Recording your dream...',
  'Preserving the vision...',
  'Capturing the threads...',
  'Weaving the memory...',
  'Etching into the grimoire...',
  'Binding the fragments...',
  'Sealing the vision...',
  'Stitching the dreamscape...',
];

const INTERPRETING_MESSAGES = [
  'Consulting the dream oracle...',
  'Reading the symbols...',
  'Gazing into the depths...',
  'Interpreting the signs...',
  'Unraveling the mystery...',
  'Tracing the threads of meaning...',
  'Decoding the night language...',
  'Channeling ancient wisdom...',
  'Peering through the veil...',
  'Illuminating the shadows...',
];

const SUBTEXTS = [
  'The mysteries of your subconscious are being revealed...',
  'Every symbol holds a message for you...',
  'The veil between worlds grows thin...',
  'Ancient wisdom stirs in the depths...',
  'Your dreams speak in riddles and metaphors...',
  'The night has much to tell...',
  'Patterns emerge from the darkness...',
  'The stars align with your vision...',
  'Symbols surface from the deep...',
  'The oracle listens carefully...',
];

const MESSAGE_INTERVAL = 3500;

type Props = {
  phase: 'saving' | 'interpreting';
};

export default function DreamLoadingAnimation({ phase }: Props) {
  const messages = phase === 'saving' ? SAVING_MESSAGES : INTERPRETING_MESSAGES;
  const [messageIndex, setMessageIndex] = useState(0);
  const [subtextIndex, setSubtextIndex] = useState(0);

  const messageFade = useRef(new Animated.Value(1)).current;
  const subtextFade = useRef(new Animated.Value(1)).current;
  const moonScale = useRef(new Animated.Value(1)).current;
  const moonOpacity = useRef(new Animated.Value(0.8)).current;

  // Pulsing moon animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(moonScale, {
            toValue: 1.15,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(moonOpacity, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(moonScale, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(moonOpacity, {
            toValue: 0.6,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [moonScale, moonOpacity]);

  // Rotating messages with crossfade
  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      Animated.parallel([
        Animated.timing(messageFade, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(subtextFade, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
        setSubtextIndex((prev) => (prev + 1) % SUBTEXTS.length);
        // Fade in
        Animated.parallel([
          Animated.timing(messageFade, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(subtextFade, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, MESSAGE_INTERVAL);

    return () => clearInterval(interval);
  }, [messages.length, messageFade, subtextFade]);

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[
          styles.moonGlyph,
          {
            transform: [{ scale: moonScale }],
            opacity: moonOpacity,
          },
        ]}
      >
        {phase === 'saving' ? '\u{1F319}' : '\u{1F311}'}
      </Animated.Text>

      <Animated.Text style={[styles.message, { opacity: messageFade }]}>
        {messages[messageIndex]}
      </Animated.Text>

      <Animated.Text style={[styles.subtext, { opacity: subtextFade }]}>
        {SUBTEXTS[subtextIndex]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  moonGlyph: {
    fontSize: 56,
    marginBottom: 32,
  },
  message: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0d4f7',
    textAlign: 'center',
    minHeight: 28,
  },
  subtext: {
    fontSize: 14,
    color: '#8b7fa8',
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    minHeight: 20,
  },
});
