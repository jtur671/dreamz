import { useWindowDimensions, ViewStyle } from 'react-native';

const TABLET_BREAKPOINT = 768;
const MAX_CONTENT_WIDTH = 600;

/**
 * Provides responsive layout values for iPad vs iPhone.
 * On tablets, returns a maxWidth style to constrain content to a readable width.
 */
export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const contentStyle: ViewStyle | undefined = isTablet
    ? { maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%' }
    : undefined;

  return { isTablet, contentStyle, screenWidth: width };
}
