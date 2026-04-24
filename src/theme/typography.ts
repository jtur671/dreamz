import { TextStyle } from 'react-native';

export const fonts = {
  displayBold: 'Fraunces_700Bold',
  displaySemiBold: 'Fraunces_600SemiBold',
  displayRegular: 'Fraunces_400Regular',
  bodyRegular: 'InstrumentSans_400Regular',
  bodyMedium: 'InstrumentSans_500Medium',
  bodySemiBold: 'InstrumentSans_600SemiBold',
} as const;

export const typography = {
  display: {
    fontFamily: fonts.displayBold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.5,
  } as TextStyle,
  title: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.25,
  } as TextStyle,
  subtitle: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
    lineHeight: 24,
  } as TextStyle,
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  } as TextStyle,
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
  } as TextStyle,
  bodyLarge: {
    fontFamily: fonts.bodyRegular,
    fontSize: 17,
    lineHeight: 26,
  } as TextStyle,
  caption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
  } as TextStyle,
  serifBody: {
    fontFamily: fonts.displayRegular,
    fontSize: 17,
    lineHeight: 26,
  } as TextStyle,
} as const;

export type Typography = typeof typography;
