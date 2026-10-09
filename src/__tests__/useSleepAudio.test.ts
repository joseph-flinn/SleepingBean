/**
 * Resilience tests for the sleep-audio hook (`fix-overnight-audio-crash`).
 *
 * `expo-audio` is replaced by the centralized mock in `<root>/__mocks__/expo-audio.ts`
 * (hoisted to module scope, as required by `jest.mock`), which lets these tests
 * script native failures and fire `playbackStatusUpdate` events by hand.
 */
import { act, renderHook } from '@testing-library/react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

import { audioMock } from './audio-mock';

import { createSafeCall } from '../hooks/safeCall';
import {
  MAX_CONSECUTIVE_RECOVERY_FAILURES,
  recoveryPolicy,
  shouldSeekToStart,
  useSleepAudio,
  type SleepAudio,
} from '../hooks/useSleepAudio';

jest.mock('expo-audio');

const useAudioPlayerMock = useAudioPlayer as unknown as jest.Mock;
const setAudioModeMock = setAudioModeAsync as unknown as jest.Mock;

/** Runs a user tap on the play/pause control and flushes the queued player calls. */
async function tap(result: { current: SleepAudio }) {
  await act(async () => {
    result.current.toggle();
  });
}

/** Fires a `playbackStatusUpdate` the way the native player would. */
async function emitStatus(patch: Parameters<typeof audioMock.emit>[0]) {
  await act(async () => {
    audioMock.emit(patch);
  });
}

let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;

beforeEach(() => {
  audioMock.reset();
  recoveryPolicy.throttleMs = 2000;
  recoveryPolicy.maxFailures = MAX_CONSECUTIVE_RECOVERY_FAILURES;
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  consoleWarn.mockRestore();
});

describe('task 2.1 — background audio mode setup', () => {
  it('configures background playback and lock screen controls on mount', async () => {
    await renderHook(() => useSleepAudio());

    expect(setAudioModeMock).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  });

  it('logs a setup failure under the [sleep-audio] prefix instead of rejecting', async () => {
    setAudioModeMock.mockRejectedValueOnce(new Error('Audio mode rejected by the system'));

    const { result } = await renderHook(() => useSleepAudio());

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[sleep-audio]'),
      expect.objectContaining({ message: 'Audio mode rejected by the system' }),
    );
    // The failure must not take the player down with it.
    await tap(result);
    expect(audioMock.player.play).toHaveBeenCalledTimes(1);
  });

  it('binds the lock screen session with metadata when playback starts', async () => {
    const { result } = await renderHook(() => useSleepAudio());

    await tap(result);

    expect(audioMock.player.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ title: expect.any(String) }),
    );
    expect(audioMock.player.play).toHaveBeenCalledTimes(1);
  });
});

describe('task 2.2 — serialized, non-throwing player mutations', () => {
  it('resolves false and logs when a mutation rejects', async () => {
    const log = jest.fn();
    const safeCall = createSafeCall(log);

    const outcome = await safeCall('play', async () => {
      throw new Error('bridge is gone');
    });

    expect(outcome).toBe(false);
    expect(log).toHaveBeenCalledWith('play failed', expect.objectContaining({ message: 'bridge is gone' }));
  });

  it('catches synchronous throws too', async () => {
    const log = jest.fn();
    const safeCall = createSafeCall(log);

    await expect(safeCall('loop', () => {
      throw new TypeError('shared object released');
    })).resolves.toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('serializes calls behind the one already in flight', async () => {
    const safeCall = createSafeCall(jest.fn());
    const order: string[] = [];
    const gate = deferred();

    const first = safeCall('recovery', async () => {
      await gate.promise;
      order.push('recovery');
    });
    const second = safeCall('user tap', () => {
      order.push('user tap');
    });

    // The recovery is still awaiting the native side, so the tap has not run.
    await flushMicrotasks();
    expect(order).toEqual([]);

    gate.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(['recovery', 'user tap']);
  });

  it('keeps working after a failing play: the failure is logged and later taps still reach the player', async () => {
    const { result } = await renderHook(() => useSleepAudio());

    audioMock.player.play.mockImplementationOnce(() => {
      throw new Error('Audio focus lost');
    });
    await tap(result);

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[sleep-audio]'),
      expect.objectContaining({ message: 'Audio focus lost' }),
    );

    // The hook survived: the next tap runs the real mock implementation.
    await tap(result);
    expect(audioMock.player.play).toHaveBeenCalledTimes(2);
    expect(result.current.playing).toBe(true);
  });

  it('keeps working after a failed lock screen bind', async () => {
    const { result } = await renderHook(() => useSleepAudio());

    audioMock.player.setActiveForLockScreen.mockImplementationOnce(() => {
      throw new Error('Media session reset');
    });
    await tap(result);

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('[sleep-audio]'), expect.any(Error));
    expect(result.current.playing).toBe(true);
  });
});

describe('task 2.3 — recovery from a status event', () => {
  it('re-binds the session and resumes when the system pauses us mid-night', async () => {
    const { result } = await renderHook(() => useSleepAudio());
    await tap(result);

    audioMock.player.setActiveForLockScreen.mockClear();
    audioMock.player.play.mockClear();

    await emitStatus({ playing: false });

    expect(audioMock.player.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ title: expect.any(String) }),
    );
    expect(audioMock.player.play).toHaveBeenCalledTimes(1);
    expect(result.current.playing).toBe(true);
  });

  it('never recovers after the user explicitly paused', async () => {
    const { result } = await renderHook(() => useSleepAudio());
    await tap(result);
    await tap(result);
    expect(audioMock.player.pause).toHaveBeenCalledTimes(1);

    audioMock.player.play.mockClear();
    audioMock.player.setActiveForLockScreen.mockClear();

    await emitStatus({ playing: false });
    await emitStatus({ playing: false });

    expect(audioMock.player.play).not.toHaveBeenCalled();
    expect(audioMock.player.setActiveForLockScreen).not.toHaveBeenCalled();
    expect(result.current.playing).toBe(false);
  });

  it('throttles repeated status events into one recovery attempt', async () => {
    const { result } = await renderHook(() => useSleepAudio());
    await tap(result);

    // A wedged player: reports no status change, so the throttle is observable.
    audioMock.player.play.mockImplementation(() => {});
    audioMock.player.play.mockClear();

    await emitStatus({ playing: false });
    await emitStatus({ playing: false });
    await emitStatus({ playing: false });

    expect(audioMock.player.play).toHaveBeenCalledTimes(1);
  });

  it('recovers again once the throttle window has passed', async () => {
    recoveryPolicy.throttleMs = 10;
    const { result } = await renderHook(() => useSleepAudio());
    await tap(result);

    audioMock.player.play.mockImplementation(() => {});
    audioMock.player.play.mockClear();

    await emitStatus({ playing: false });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    await emitStatus({ playing: false });

    expect(audioMock.player.play).toHaveBeenCalledTimes(2);
  });

  it('gives up quietly after the configured consecutive failures', async () => {
    recoveryPolicy.throttleMs = 0;
    const { result } = await renderHook(() => useSleepAudio());
    await tap(result);

    audioMock.player.play.mockImplementation(() => {
      throw new Error('player wedged');
    });
    audioMock.player.setActiveForLockScreen.mockImplementation(() => {
      throw new Error('player wedged');
    });

    for (let attempt = 0; attempt < MAX_CONSECUTIVE_RECOVERY_FAILURES * 2; attempt += 1) {
      await emitStatus({ playing: false });
    }

    // One play from the user tap, then exactly `maxFailures` recovery attempts.
    expect(audioMock.player.play).toHaveBeenCalledTimes(1 + MAX_CONSECUTIVE_RECOVERY_FAILURES);
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('[sleep-audio]'));
  });

  it('resets the failure budget when the user taps again', async () => {
    recoveryPolicy.throttleMs = 0;
    const { result } = await renderHook(() => useSleepAudio());
    await tap(result);

    audioMock.player.play.mockImplementation(() => {
      throw new Error('player wedged');
    });
    for (let attempt = 0; attempt < MAX_CONSECUTIVE_RECOVERY_FAILURES; attempt += 1) {
      await emitStatus({ playing: false });
    }
    const attemptsBeforeTap = audioMock.player.play.mock.calls.length;

    audioMock.player.play.mockImplementation(() => {});
    await tap(result);
    await emitStatus({ playing: false });

    expect(audioMock.player.play.mock.calls.length).toBeGreaterThan(attemptsBeforeTap);
  });

  it('stays quiet when no status event ever arrives (no watchdog spins)', async () => {
    const { result } = await renderHook(() => useSleepAudio());
    await tap(result);

    audioMock.clearEventListeners();
    audioMock.player.play.mockClear();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(audioMock.player.play).not.toHaveBeenCalled();
  });

  it('subscribes once and removes the subscription on unmount', async () => {
    const { unmount } = await renderHook(() => useSleepAudio());
    expect(audioMock.eventListenerCount()).toBe(1);

    await unmount();

    expect(audioMock.eventListenerCount()).toBe(0);
  });
});

describe('task 2.4 — loop, position and player identity', () => {
  it('enables looping on the player', async () => {
    await renderHook(() => useSleepAudio());

    expect(audioMock.player.loop).toBe(true);
  });

  it('resumes from the current position instead of rewinding', async () => {
    const { result } = await renderHook(() => useSleepAudio());
    await tap(result);
    await tap(result);

    await emitStatus({ playing: false, currentTime: 4.2 });
    await tap(result);

    expect(audioMock.player.seekTo).not.toHaveBeenCalled();
    expect(audioMock.player.play).toHaveBeenCalledTimes(2);
  });

  it('rewinds to the start when the loaded track is at its end', async () => {
    const { result } = await renderHook(() => useSleepAudio());

    await emitStatus({ playing: false, currentTime: 10 });
    await tap(result);

    expect(audioMock.player.seekTo).toHaveBeenCalledWith(0);
  });

  it('reuses one player instance across repeated toggles', async () => {
    const { result } = await renderHook(() => useSleepAudio());
    const player = audioMock.player;

    for (let i = 0; i < 4; i += 1) {
      await tap(result);
    }

    expect(audioMock.player).toBe(player);
    const instances = new Set(useAudioPlayerMock.mock.results.map((entry) => entry.value));
    expect(instances).toEqual(new Set([player]));
    expect(player.play).toHaveBeenCalledTimes(2);
    expect(player.pause).toHaveBeenCalledTimes(2);
  });

  describe('shouldSeekToStart', () => {
    it('is false while paused mid-track', () => {
      expect(shouldSeekToStart({ isLoaded: true, duration: 10, currentTime: 4.2 })).toBe(false);
    });

    it('is true at or past the end of a loaded track', () => {
      expect(shouldSeekToStart({ isLoaded: true, duration: 10, currentTime: 10 })).toBe(true);
      expect(shouldSeekToStart({ isLoaded: true, duration: 10, currentTime: 11 })).toBe(true);
      expect(shouldSeekToStart({ isLoaded: true, duration: 10, currentTime: 2, didJustFinish: true })).toBe(true);
    });

    it('is false while the track is still loading or its duration is unknown', () => {
      expect(shouldSeekToStart({ isLoaded: false, duration: 10, currentTime: 10 })).toBe(false);
      expect(shouldSeekToStart({ isLoaded: true, duration: 0, currentTime: 0 })).toBe(false);
      expect(shouldSeekToStart(undefined)).toBe(false);
    });
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
