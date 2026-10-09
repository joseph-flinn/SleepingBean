import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { IconButton } from '../components/IconButton';
import { PlayIcon, PauseIcon } from '../components/AudioIcons';
import { AppNameLogo } from '../components/AppNameLogo';
import { useTheme } from '../ThemeContext';
import { useSleepAudio } from '../hooks/useSleepAudio';

export function AudioControl() {
  const { playing, toggle } = useSleepAudio();
  const { width, height } = useWindowDimensions();
  const { theme } = useTheme();
  const iconSize = width / 2;

  const iconColor = theme.colors.textSecondary;
  const logoColor = theme.colors.textSecondary;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          {
            width: width * 0.95,
            height: height * 0.95,
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <AppNameLogo
          width={width * 0.7}
          color={logoColor}
          style={styles.logo}
        />

        <IconButton
          testID="audio-play-button"
          onPress={toggle}
          size={iconSize}
          icon={
            playing ? (
              <PauseIcon size={iconSize} color={iconColor} />
            ) : (
              <PlayIcon size={iconSize} color={iconColor} />
            )
          }
          accessibilityLabel={playing ? 'Pause audio' : 'Play audio'}
          accessibilityRole="button"
        />
      </View>
    </View>
  );
}

export default AudioControl;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  logo: {
    position: 'absolute',
    top: 32,
  },
});
