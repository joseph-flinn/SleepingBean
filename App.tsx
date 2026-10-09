import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AudioControl } from './src/components/AudioControl';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import { useThemedStyles } from './src/hooks/useThemedStyles';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { AppTheme } from './src/theme';

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.background,
    },
  });

function AppContent() {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <AudioControl />
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
