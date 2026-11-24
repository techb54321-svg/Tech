import { useColorScheme } from 'react-native';

import { palette, type Palette } from './colors';

export { palette };
export type { Palette };

export function useColors(): Palette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palette.dark : palette.light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;
