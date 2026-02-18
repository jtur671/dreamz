import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

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
  'Painting your dream...',
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
const NUM_ORBS = 6;
const SPARKLE_CHARS = ['\u2728', '\u2727', '\u2726', '\u2729', '\u00B7', '\u2022'];

type Props = {
  phase: 'saving' | 'interpreting';
};

export default function DreamLoadingAnimation({ phase }: Props) {
  const messages = phase === 'saving' ? SAVING_MESSAGES : INTERPRETING_MESSAGES;
  const [messageIndex, setMessageIndex] = useState(0);
  const [subtextIndex, setSubtextIndex] = useState(0);

  const messageFade = useRef(new Animated.Value(1)).current;
  const subtextFade = useRef(new Animated.Value(1)).current;

  // Central glyph animations
  const glyphFloat = useRef(new Animated.Value(0)).current;
  const glyphScale = useRef(new Animated.Value(1)).current;
  const glyphOpacity = useRef(new Animated.Value(0.85)).current;

  // Aura ring animation
  const auraScale = useRef(new Animated.Value(0.8)).current;
  const auraOpacity = useRef(new Animated.Value(0.3)).current;
  const auraScale2 = useRef(new Animated.Value(0.6)).current;
  const auraOpacity2 = useRef(new Animated.Value(0.2)).current;

  // Orbiting sparkles
  const orbRotations = useRef(
    Array.from({ length: NUM_ORBS }, () => new Animated.Value(0))
  ).current;
  const orbOpacities = useRef(
    Array.from({ length: NUM_ORBS }, () => new Animated.Value(0))
  ).current;

  // Floating glyph (gentle up/down bob)
  useEffect(() => {
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(glyphFloat, {
          toValue: -8,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glyphFloat, {
          toValue: 8,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    float.start();
    return () => float.stop();
  }, [glyphFloat]);

  // Glyph pulse (scale + opacity)
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glyphScale, {
            toValue: 1.12,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glyphOpacity, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glyphScale, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glyphOpacity, {
            toValue: 0.7,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [glyphScale, glyphOpacity]);

  // Aura ring 1 - expanding pulse
  useEffect(() => {
    const aura = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(auraScale, {
            toValue: 1.6,
            duration: 2500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(auraOpacity, {
            toValue: 0,
            duration: 2500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(auraScale, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(auraOpacity, {
            toValue: 0.3,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    aura.start();
    return () => aura.stop();
  }, [auraScale, auraOpacity]);

  // Aura ring 2 - staggered
  useEffect(() => {
    const delay = setTimeout(() => {
      const aura2 = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(auraScale2, {
              toValue: 1.4,
              duration: 2500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(auraOpacity2, {
              toValue: 0,
              duration: 2500,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(auraScale2, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(auraOpacity2, {
              toValue: 0.2,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      aura2.start();
    }, 1200);
    return () => clearTimeout(delay);
  }, [auraScale2, auraOpacity2]);

  // Orbiting sparkles
  useEffect(() => {
    const animations = orbRotations.map((rot, i) => {
      // Each orb has a different speed and start delay
      const duration = 4000 + i * 800;
      return Animated.loop(
        Animated.timing(rot, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
    });

    // Sparkle fade in/out
    const opacityAnimations = orbOpacities.map((op, i) => {
      const duration = 1500 + i * 300;
      return Animated.loop(
        Animated.sequence([
          Animated.timing(op, {
            toValue: 0.9,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(op, {
            toValue: 0.15,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
    });

    animations.forEach((a) => a.start());
    opacityAnimations.forEach((a) => a.start());

    return () => {
      animations.forEach((a) => a.stop());
      opacityAnimations.forEach((a) => a.stop());
    };
  }, [orbRotations, orbOpacities]);

  // Rotating messages with crossfade
  useEffect(() => {
    const interval = setInterval(() => {
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

  const orbRadius = 60;

  return (
    <View style={styles.container}>
      {/* Visual area */}
      <View style={styles.orbitalArea}>
        {/* Aura ring 1 */}
        <Animated.View
          style={[
            styles.auraRing,
            {
              transform: [{ scale: auraScale }],
              opacity: auraOpacity,
            },
          ]}
        />
        {/* Aura ring 2 */}
        <Animated.View
          style={[
            styles.auraRing2,
            {
              transform: [{ scale: auraScale2 }],
              opacity: auraOpacity2,
            },
          ]}
        />

        {/* Orbiting sparkles */}
        {orbRotations.map((rot, i) => {
          const angle = (i / NUM_ORBS) * 2 * Math.PI;
          const spin = rot.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          });

          return (
            <Animated.View
              key={i}
              style={[
                styles.orbContainer,
                {
                  transform: [{ rotate: spin }],
                },
              ]}
            >
              <Animated.Text
                style={[
                  styles.sparkle,
                  {
                    opacity: orbOpacities[i],
                    transform: [
                      { translateX: Math.cos(angle) * orbRadius },
                      { translateY: Math.sin(angle) * orbRadius },
                    ],
                  },
                ]}
              >
                {SPARKLE_CHARS[i % SPARKLE_CHARS.length]}
              </Animated.Text>
            </Animated.View>
          );
        })}

        {/* Central glyph */}
        <Animated.Text
          style={[
            styles.centralGlyph,
            {
              transform: [
                { translateY: glyphFloat },
                { scale: glyphScale },
              ],
              opacity: glyphOpacity,
            },
          ]}
        >
          {phase === 'saving' ? '\u{1F319}' : '\u{1F52E}'}
        </Animated.Text>
      </View>

      {/* Messages */}
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
  orbitalArea: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  auraRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: '#9b7fd4',
    backgroundColor: 'rgba(107, 78, 158, 0.08)',
  },
  auraRing2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: '#c4a8f0',
    backgroundColor: 'rgba(155, 127, 212, 0.05)',
  },
  orbContainer: {
    position: 'absolute',
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkle: {
    fontSize: 14,
    color: '#c4b8e8',
  },
  centralGlyph: {
    fontSize: 52,
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
