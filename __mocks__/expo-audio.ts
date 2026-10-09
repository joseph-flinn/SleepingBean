/**
 * Centralized `expo-audio` mock, shared by every test that touches the
 * sleep-audio player. Jest resolves `<root>/__mocks__/expo-audio.ts` for the
 * `expo-audio` node module, and test files import it directly to script
 * behaviour and make assertions:
 *
 * ```ts
 * import { audioMock } from '../../__mocks__/expo-audio';
 *
 * jest.mock('expo-audio');
 *
 * audioMock.player.play.mockImplementationOnce(() => {
 *   throw new Error('audio focus lost');
 * });
 * await act(async () => audioMock.emit({ playing: false }));
 * ```
 *
 * `play()` / `pause()` behave like the native player: they update the status and
 * fire `playbackStatusUpdate` to every subscriber, unless a test replaces the
 * implementation to simulate a rejected call.
 */
import { jest } from '@jest/globals';
import { useEffect, useState } from 'react';

export type MockAudioStatus = {
  id: string;
  playing: boolean;
  isLoaded: boolean;
  currentTime: number;
  duration: number;
  didJustFinish: boolean;
  loop: boolean;
};

type StatusListener = (status: MockAudioStatus) => void;

const createStatus = (): MockAudioStatus => ({
  id: 'mock-audio-player',
  playing: false,
  isLoaded: true,
  currentTime: 0,
  duration: 10,
  didJustFinish: false,
  loop: false,
});

/** Listeners registered through `player.addListener('playbackStatusUpdate')`. */
let eventListeners = new Set<StatusListener>();
/** Listeners registered through `useAudioPlayerStatus()` (React re-renders). */
let statusHookListeners = new Set<StatusListener>();

const notify = (status: MockAudioStatus) => {
  for (const listener of [...eventListeners]) listener({ ...status });
  for (const listener of [...statusHookListeners]) listener({ ...status });
};

const createPlayer = () => {
  const status = createStatus();

  return {
    id: status.id,
    status,
    loop: false,
    play: jest.fn(() => {
      status.playing = true;
      notify(status);
    }),
    pause: jest.fn(() => {
      status.playing = false;
      notify(status);
    }),
    seekTo: jest.fn(async (seconds: number) => {
      status.currentTime = seconds;
    }),
    setActiveForLockScreen: jest.fn(),
    clearLockScreenControls: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn((event: string, listener: StatusListener) => {
      if (event !== 'playbackStatusUpdate') {
        throw new Error(`expo-audio mock: unsupported event "${event}"`);
      }
      eventListeners.add(listener);
      return { remove: jest.fn(() => eventListeners.delete(listener)) };
    }),
  };
};

type MockAudioPlayer = ReturnType<typeof createPlayer>;

let player: MockAudioPlayer | null = null;

const ensurePlayer = (): MockAudioPlayer => {
  if (player === null) {
    player = createPlayer();
  }
  return player;
};

export const audioMock = {
  /** The player instance handed out by `useAudioPlayer()`. */
  get player(): MockAudioPlayer {
    return ensurePlayer();
  },
  /** Current status of the mocked player. */
  get status(): MockAudioStatus {
    return ensurePlayer().status;
  },
  /** Update the status silently (picked up on the next render). */
  setStatus(patch: Partial<MockAudioStatus>) {
    Object.assign(ensurePlayer().status, patch);
  },
  /** Update the status and fire `playbackStatusUpdate` to every subscriber. */
  emit(patch: Partial<MockAudioStatus> = {}) {
    const current = ensurePlayer();
    Object.assign(current.status, patch);
    notify(current.status);
  },
  /** Live `player.addListener('playbackStatusUpdate')` subscriptions. */
  eventListenerCount: () => eventListeners.size,
  /** Simulate a native side that stopped emitting. */
  clearEventListeners: () => {
    eventListeners.clear();
  },
  /** Discard the player instance and every listener; call between tests. */
  reset() {
    eventListeners = new Set();
    statusHookListeners = new Set();
    player = null;
  },
};

export const useAudioPlayer = jest.fn(() => ensurePlayer());

export const useAudioPlayerStatus = jest.fn(() => {
  const [status, setStatus] = useState<MockAudioStatus>(() => ({ ...ensurePlayer().status }));

  useEffect(() => {
    const listener: StatusListener = (next) => setStatus({ ...next });
    statusHookListeners.add(listener);
    return () => {
      statusHookListeners.delete(listener);
    };
  }, []);

  return status;
});

export const setAudioModeAsync = jest.fn(async () => {});

export default {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
};
