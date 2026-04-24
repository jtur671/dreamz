import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../theme';

export type SymbolName =
  | 'key'
  | 'door'
  | 'staircase'
  | 'mirror'
  | 'bridge'
  | 'water'
  | 'moon'
  | 'hand'
  | 'eye'
  | 'bird'
  | 'tree'
  | 'fire'
  | 'feather'
  | 'book'
  | 'scroll'
  | 'gear';

type Props = {
  name: SymbolName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

const STROKE_PROPS = {
  fill: 'none' as const,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const SymbolIcon: React.FC<Props> = ({
  name,
  size = 40,
  color = colors.ochre.gold,
  strokeWidth = 2,
}) => {
  const stroke = color;
  const sw = strokeWidth;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {renderSymbol(name, stroke, sw)}
    </Svg>
  );
};

function renderSymbol(name: SymbolName, stroke: string, sw: number) {
  switch (name) {
    case 'key':
      return (
        <>
          <Circle cx={60} cy={30} r={16} stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Circle cx={60} cy={30} r={6} stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 46 L60 102" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 78 L74 78" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 90 L70 90" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 102 L74 102 L74 94" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    case 'door':
      return (
        <>
          <Path d="M36 108 L36 18 L84 18 L84 108" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M36 108 L84 108" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M46 28 L46 98 L84 108 L84 18 Z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Circle cx={52} cy={62} r={1.5} fill={stroke} />
        </>
      );
    case 'staircase':
      return (
        <>
          <Path d="M20 104 L20 92 L40 92 L40 80 L60 80 L60 68 L80 68 L80 56 L100 56 L100 44" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M20 104 L100 104" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M40 92 L40 104" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 80 L60 104" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M80 68 L80 104" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M100 56 L100 104" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    case 'mirror':
      return (
        <>
          <Path d="M40 26 Q40 14 60 14 Q80 14 80 26 L80 86 Q80 94 60 94 Q40 94 40 86 Z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 94 L60 106" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M46 106 L74 106" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M48 34 Q50 28 54 26" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    case 'bridge':
      return (
        <>
          <Path d="M14 84 Q60 34 106 84" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M22 84 L22 104" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M98 84 L98 104" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M14 104 L106 104" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M38 68 L38 82" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 60 L60 82" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M82 68 L82 82" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    case 'water':
      return (
        <>
          <Path d="M12 44 Q30 32 48 44 T84 44 T108 44" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M12 68 Q30 56 48 68 T84 68 T108 68" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M12 92 Q30 80 48 92 T84 92 T108 92" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    case 'moon':
      return (
        <Path d="M78 18 Q40 34 40 60 Q40 86 78 102 Q54 94 46 60 Q54 26 78 18 Z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
      );
    case 'hand':
      return (
        <>
          <Path d="M36 70 L36 46 Q36 40 42 40 Q48 40 48 46 L48 30 Q48 24 54 24 Q60 24 60 30 L60 28 Q60 22 66 22 Q72 22 72 28 L72 34 Q72 28 78 28 Q84 28 84 34 L84 74 Q84 94 66 100 Q42 104 36 84 Z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 30 L60 62" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M48 46 L48 66" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M72 34 L72 62" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    case 'eye':
      return (
        <>
          <Path d="M12 60 Q40 32 60 32 Q80 32 108 60 Q80 88 60 88 Q40 88 12 60 Z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Circle cx={60} cy={60} r={14} stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Circle cx={60} cy={60} r={5} fill={stroke} />
        </>
      );
    case 'bird':
      return (
        <>
          <Path d="M18 72 Q34 52 58 54 Q72 56 84 46 Q94 38 106 30" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M58 54 Q60 70 52 82" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M58 54 Q66 68 76 72" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M84 46 L90 40 L86 40 L86 36" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Circle cx={88} cy={38} r={1} fill={stroke} />
        </>
      );
    case 'tree':
      return (
        <>
          <Path d="M60 108 L60 60" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 60 L42 40" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 60 L78 40" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 50 L50 32" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 50 L70 32" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M42 40 L32 28" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M42 40 L40 22" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M78 40 L88 28" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M78 40 L80 22" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M54 30 L50 18" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M66 30 L70 18" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 40 L60 20" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    case 'fire':
      return (
        <>
          <Path d="M60 14 Q70 34 78 46 Q90 60 86 78 Q82 98 60 104 Q38 98 34 78 Q30 64 42 50 Q50 42 48 30 Q54 40 60 40 Q60 26 60 14 Z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 104 Q48 90 52 76 Q56 66 62 70 Q60 80 66 82 Q70 90 60 104 Z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    case 'feather':
      return (
        <>
          <Path d="M92 24 Q100 28 96 40 Q88 62 68 82 Q50 100 32 102 Q30 102 30 100 Q32 92 44 80 Q64 62 84 44 Q90 32 92 24 Z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M40 94 L80 38" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M44 86 L56 80" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M52 78 L64 70" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 68 L72 58" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M68 58 L80 46" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    case 'book':
      return (
        <>
          <Path d="M24 30 L60 36 L96 30 L96 94 L60 100 L24 94 Z" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 36 L60 100" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M34 48 L50 50" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M34 60 L50 62" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M34 72 L50 74" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M70 50 L86 48" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M70 62 L86 60" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M70 74 L86 72" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    case 'scroll':
      return (
        <>
          <Path d="M20 30 Q20 22 28 22 L86 22 Q94 22 94 30 Q94 38 86 38 L28 38" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M28 38 Q20 38 20 46 L20 90 Q20 98 28 98 L86 98 Q94 98 94 90 Q94 82 86 82 L34 82" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M34 82 Q26 82 26 74" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M38 52 L80 52" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M38 64 L80 64" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    case 'gear':
      return (
        <>
          <Circle cx={60} cy={60} r={18} stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Circle cx={60} cy={60} r={6} stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 28 L60 40" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M60 80 L60 92" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M28 60 L40 60" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M80 60 L92 60" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M38 38 L46 46" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M74 74 L82 82" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M82 38 L74 46" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
          <Path d="M46 74 L38 82" stroke={stroke} strokeWidth={sw} {...STROKE_PROPS} />
        </>
      );
    default:
      return null;
  }
}
