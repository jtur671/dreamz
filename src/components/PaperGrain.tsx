import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Filter, FeTurbulence, FeColorMatrix, Rect } from 'react-native-svg';

type Props = {
  opacity?: number;
  seed?: number;
};

/**
 * Tileable paper-grain overlay. Uses an SVG feTurbulence filter so there's
 * no binary asset to ship, no cache-invalidation issue, and the grain scales
 * to any screen. Place behind content at low opacity (default 0.08) to make
 * aubergine backgrounds read as paper rather than digital flat.
 */
export const PaperGrain: React.FC<Props> = ({ opacity = 0.08, seed = 7 }) => {
  const filterId = useMemo(() => `paperGrain${seed}`, [seed]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Filter id={filterId} x="0" y="0" width="100%" height="100%">
            <FeTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves={2}
              seed={seed}
              stitchTiles="stitch"
            />
            <FeColorMatrix
              type="matrix"
              values="0 0 0 0 0.94  0 0 0 0 0.91  0 0 0 0 0.85  0 0 0 1 0"
            />
          </Filter>
        </Defs>
        <Rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </Svg>
    </View>
  );
};
