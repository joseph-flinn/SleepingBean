import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../components/IconButton';
import { PlayIcon, PauseIcon } from '../components/AudioIcons';
import { useSleepAudio } from '../hooks/useSleepAudio';

export function AudioControl() {
  const { playing, toggle } = useSleepAudio();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const isDark = scheme === 'dark';
  const textColor = isDark ? '#EAD2AC' : '#03110d';
  const mutedTextColor = isDark ? 'rgba(234, 210, 172, 0.55)' : 'rgba(3, 17, 13, 0.55)';
  const iconColor = isDark ? '#D8B589' : '#03110d';
  const borderColor = isDark ? 'rgba(218, 181, 137, 0.35)' : 'rgba(3, 17, 13, 0.2)';

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.row}>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: textColor }]}>Sleep Audio</Text>
          <Text style={[styles.subtitle, { color: mutedTextColor }]}>
            {playing ? 'Playing' : 'Paused'}
          </Text>
        </View>

        <View
          style={[styles.buttonWrapper, { borderColor }]}
        >
          <IconButton
            testID="audio-play-button"
            onPress={toggle}
            icon={playing ? <PauseIcon color={iconColor} /> : <PlayIcon color={iconColor} />}
            accessibilityLabel={playing ? 'Pause audio' : 'Play audio'}
            accessibilityRole="button"
          />
        </View>
      </View>
    </View>
  );
}

export default AudioControl;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
  textContainer: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
  },
  buttonWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
