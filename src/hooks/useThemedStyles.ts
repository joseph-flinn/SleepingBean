import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';
import type { AppTheme } from '../theme';

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  styleFn: (theme: AppTheme) => T,
): T {
  const { theme } = useTheme();
  return useMemo(() => StyleSheet.create(styleFn(theme)), [theme, styleFn]);
}
