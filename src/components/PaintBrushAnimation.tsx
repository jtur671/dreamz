import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';

const MESSAGES = [
  'Painting your dream...',
  'Mixing the colors of night...',
  'Tracing shapes from the mist...',
  'Weaving moonlight into canvas...',
  'Capturing shadows and light...',
];

export default function PaintBrushAnimation() {
  const { width: screenWidth } = useWindowDimensions();
  const containerHeight = screenWidth * 0.75;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnims = useRef(
    Array.from({ length: 6 }, () => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.3),
    }))
  ).current;
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    // Main brush sweep loop
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepAnim, {
          toValue: 1,
          duration: 5500,
          useNativeDriver: true,
        }),
        Animated.timing(sweepAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    sweep.start();

    // Sparkle animations — staggered loop
    const sparkleAnimations = sparkleAnims.map((sparkle, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 800),
          Animated.parallel([
            Animated.timing(sparkle.opacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(sparkle.scale, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(sparkle.opacity, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(sparkle.scale, {
              toValue: 0.3,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(Math.max(0, (sparkleAnims.length - 1 - i) * 800)),
        ])
      )
    );
    sparkleAnimations.forEach((a) => a.start());

    // Rotate messages
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 5500);

    return () => {
      sweep.stop();
      sparkleAnimations.forEach((a) => a.stop());
      clearInterval(messageInterval);
    };
  }, []);

  const brushTranslateX = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, screenWidth],
  });

  // Reveal gradient width follows brush
  const revealWidth = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenWidth],
  });

  // Sparkle positions (scattered across area)
  const sparklePositions = [
    { top: '20%', left: '15%' },
    { top: '35%', left: '65%' },
    { top: '55%', left: '30%' },
    { top: '25%', left: '80%' },
    { top: '65%', left: '50%' },
    { top: '45%', left: '20%' },
  ];

  return (
    <View style={[styles.container, { width: screenWidth, height: containerHeight }]}>
      {/* Dark base */}
      <View style={styles.baseLayer} />

      {/* Revealed gradient layer */}
      <Animated.View
        style={[
          styles.revealLayer,
          {
            transform: [{ scaleX: revealWidth.interpolate({
              inputRange: [0, screenWidth],
              outputRange: [0, 1],
            }) }],
          },
        ]}
      />

      {/* Sparkles */}
      {sparkleAnims.map((sparkle, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.sparkle,
            sparklePositions[i] as any,
            {
              opacity: sparkle.opacity,
              transform: [{ scale: sparkle.scale }],
            },
          ]}
        >
          {i % 2 === 0 ? '\u2728' : '\u2727'}
        </Animated.Text>
      ))}

      {/* Brush emoji following sweep */}
      <Animated.Text
        style={[
          styles.brush,
          { transform: [{ translateX: brushTranslateX }] },
        ]}
      >
        {'\uD83D\uDD8C\uFE0F'}
      </Animated.Text>

      {/* Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>{MESSAGES[messageIndex]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  baseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1e1e3a',
  },
  revealLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2a2050',
    transformOrigin: 'left',
  },
  sparkle: {
    position: 'absolute',
    fontSize: 16,
  },
  brush: {
    position: 'absolute',
    top: '45%',
    fontSize: 28,
  },
  messageContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  messageText: {
    color: '#8b7fa8',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
