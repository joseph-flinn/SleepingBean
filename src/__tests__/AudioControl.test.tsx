/**
 * `AudioControl` is now a thin view over `useSleepAudio()` (design D2), so these
 * tests assert the wiring: the icon/subtitle follow the player status and a tap
 * reaches the mocked player. The icon and the `accessibilityLabel` are driven by
 * the same `playing` flag, so the label is the observable for the icon swap
 * (`test-renderer` only exposes host elements, not component types).
 *
 * `expo-audio` uses the centralized mock in `<root>/__mocks__/expo-audio.ts`,
 * registered by the hoisted `jest.mock` below.
 */
import { act, render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AudioControl from '../components/AudioControl';
import { audioMock } from './audio-mock';

jest.mock('expo-audio');

async function renderControl() {
  return render(
    <SafeAreaProvider>
      <AudioControl />
    </SafeAreaProvider>,
  );
}

const playButton = () => screen.getByTestId('audio-play-button');

beforeEach(() => {
  audioMock.reset();
});

it('starts paused with the play control', async () => {
  await renderControl();

  expect(screen.getByText('Paused')).toBeTruthy();
  expect(playButton().props.accessibilityLabel).toBe('Play audio');
});

it('plays when the control is tapped', async () => {
  await renderControl();
  const user = userEvent.setup();

  await user.press(playButton());

  expect(audioMock.player.play).toHaveBeenCalledTimes(1);
  expect(audioMock.player.setActiveForLockScreen).toHaveBeenCalledWith(
    true,
    expect.objectContaining({ title: 'Creek' }),
  );
  expect(screen.getByText('Playing')).toBeTruthy();
  expect(playButton().props.accessibilityLabel).toBe('Pause audio');
});

it('pauses when the control is tapped again', async () => {
  await renderControl();
  const user = userEvent.setup();

  await user.press(playButton());
  await user.press(playButton());

  expect(audioMock.player.pause).toHaveBeenCalledTimes(1);
  expect(audioMock.player.play).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Paused')).toBeTruthy();
  expect(playButton().props.accessibilityLabel).toBe('Play audio');
});

it('keeps showing the playing state after recovering from a system pause', async () => {
  await renderControl();
  const user = userEvent.setup();

  await user.press(playButton());
  audioMock.player.play.mockClear();

  // The system took audio focus away overnight.
  await act(async () => {
    audioMock.emit({ playing: false });
  });

  expect(audioMock.player.play).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Playing')).toBeTruthy();
  expect(playButton().props.accessibilityLabel).toBe('Pause audio');
});
