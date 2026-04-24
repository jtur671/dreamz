import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Text } from 'react-native';
import { SymbolIcon } from './SymbolIcon';
import { colors, typography, spacing } from '../theme';

const SAVING_MESSAGES = [
  'Recording your dream',
  'Preserving the vision',
  'Capturing the threads',
  'Weaving the memory',
  'Etching into the grimoire',
  'Binding the fragments',
  'Sealing the vision',
  'Stitching the dreamscape',
];

const INTERPRETING_MESSAGES = [
  'Reading the symbols',
  'Tracing the threads',
  'Unraveling the mystery',
  'Listening for meaning',
  'Decoding the night',
  'Peering through the veil',
  'Illuminating the shadows',
];

const MESSAGE_INTERVAL = 3500;

type Props = {
  phase: 'saving' | 'interpreting';
};

export default function DreamLoadingAnimation({ phase }: Props) {
  const messages = phase === 'saving' ? SAVING_MESSAGES : INTERPRETING_MESSAGES;
  const [messageIndex, setMessageIndex] = useState(0);

  const rotate = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(0.55)).current;
  const messageFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => spin.stop();
  }, [rotate]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.55,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseOpacity]);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(messageFade, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
        Animated.timing(messageFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, MESSAGE_INTERVAL);
    return () => clearInterval(interval);
  }, [messages.length, messageFade]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glyph: 'key' | 'eye' = phase === 'saving' ? 'key' : 'eye';

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.glyph,
          {
            opacity: pulseOpacity,
            transform: [{ rotate: spin }],
          },
        ]}
      >
        <SymbolIcon name={glyph} size={96} color={colors.ochre.gold} strokeWidth={1.5} />
      </Animated.View>
      <View style={styles.rule} />
      <Animated.Text style={[styles.message, { opacity: messageFade }]}>
        {messages[messageIndex]}
      </Animated.Text>
      <Text style={styles.caption}>— stay here —</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  glyph: {
    marginBottom: spacing.xxxl,
  },
  rule: {
    width: 48,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.ochre.gold,
    marginBottom: spacing.lg,
  },
  message: {
    ...typography.title,
    color: colors.paper.bone,
    textAlign: 'center',
    minHeight: 34,
  },
  caption: {
    ...typography.label,
    fontSize: 10,
    color: colors.paper.boneFaint,
    marginTop: spacing.md,
  },
});
