import { useCallback, useEffect, useRef } from 'react';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioMetadata,
  type AudioStatus,
} from 'expo-audio';

import { createSafeCall, SLEEP_AUDIO_LOG_PREFIX, type SafeCall } from './safeCall';

const AUDIO_FILE = require('../../assets/audio/pink-noise-10s.wav');

/** Metadata shown on the lock screen / media notification. */
const LOCK_SCREEN_METADATA: AudioMetadata = {
  title: 'Creek',
  artist: 'JF',
  albumTitle: 'Nature',
};

/**
 * Recovery attempts (bind + play) are useless if the native side is wedged, and
 * a `playbackStatusUpdate` storm would otherwise spin forever, so they are
 * throttled and capped.
 */
export const RECOVERY_THROTTLE_MS = 2000;
export const MAX_CONSECUTIVE_RECOVERY_FAILURES = 5;

/** Defaults above; mutable so tests can compress the backoff window. */
export const recoveryPolicy = {
  throttleMs: RECOVERY_THROTTLE_MS,
  maxFailures: MAX_CONSECUTIVE_RECOVERY_FAILURES,
};

/** A status object read defensively: native events may omit fields. */
export type PlayerStatusLike = {
  playing?: boolean;
  isLoaded?: boolean;
  currentTime?: number;
  duration?: number;
  didJustFinish?: boolean;
};

/**
 * Resume must continue from the paused position, so a rewind to the start is
 * only correct when the track is loaded and already at (or past) its end.
 */
export function shouldSeekToStart(status: PlayerStatusLike | undefined): boolean {
  if (!status?.isLoaded) {
    return false;
  }

  const duration = status.duration ?? 0;
  if (duration <= 0) {
    return false;
  }

  return status.didJustFinish === true || (status.currentTime ?? 0) >= duration;
}

export type SleepAudio = {
  /** Whether audio is currently playing, according to the player status. */
  playing: boolean;
  /** Whether the user last asked for playback (the intent recovery honours). */
  wantPlaying: boolean;
  toggle: () => void;
};

/**
 * The sleep-sound player: a single looping audio source with background
 * playback and lock screen controls, resilient to the system silently taking
 * audio focus away.
 *
 * User intent lives in a ref (`wantPlaying`) and the single
 * `playbackStatusUpdate` event drives recovery, so a stop that came from the
 * system — not from the user — is restarted without ever touching React state.
 */
export function useSleepAudio(): SleepAudio {
  const player = useAudioPlayer(AUDIO_FILE);
  const status = useAudioPlayerStatus(player);

  const statusRef = useRef<PlayerStatusLike | undefined>(undefined);
  const wantPlayingRef = useRef(false);
  const recoveryFailuresRef = useRef(0);
  const lastRecoveryAtRef = useRef(0);

  const safeCallRef = useRef<SafeCall | null>(null);
  if (safeCallRef.current === null) {
    safeCallRef.current = createSafeCall();
  }
  const safeCall = safeCallRef.current;

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // The background/lock screen setup must never reject unhandled: when it fails
  // the audio keeps playing in the foreground and the failure is logged.
  useEffect(() => {
    const configureAudioMode = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix',
        });
      } catch (error) {
        console.error(`${SLEEP_AUDIO_LOG_PREFIX} Failed to configure the audio mode`, error);
      }
    };

    void configureAudioMode();
  }, []);

  // Loop forever; set once per player instance.
  useEffect(() => {
    void safeCall('Could not enable looping', () => {
      player.loop = true;
    });
  }, [player, safeCall]);

  /**
   * Re-assert the active playback session, then resume. Failures are counted so
   * a wedged native side eventually goes quiet instead of retrying forever.
   */
  const recover = useCallback(async () => {
    if (recoveryFailuresRef.current >= recoveryPolicy.maxFailures) {
      return;
    }

    const now = Date.now();
    if (now - lastRecoveryAtRef.current < recoveryPolicy.throttleMs) {
      return;
    }
    lastRecoveryAtRef.current = now;

    const bound = await safeCall('Recovery: could not bind the lock screen session', () =>
      player.setActiveForLockScreen(true, LOCK_SCREEN_METADATA),
    );
    const resumed = await safeCall('Recovery: could not resume playback', () => player.play());

    if (!bound || !resumed) {
      recoveryFailuresRef.current += 1;
      if (recoveryFailuresRef.current >= recoveryPolicy.maxFailures) {
        console.warn(
          `${SLEEP_AUDIO_LOG_PREFIX} Giving up on recovery after ${recoveryPolicy.maxFailures} consecutive failures`,
        );
      }
    }
  }, [player, safeCall]);

  const handleStatusUpdate = useCallback(
    (next?: PlayerStatusLike) => {
      if (next) {
        statusRef.current = next;
      }

      const current = statusRef.current;
      if (current?.playing) {
        recoveryFailuresRef.current = 0;
        lastRecoveryAtRef.current = 0;
        return;
      }

      // The user explicitly paused: never auto-recover.
      if (!wantPlayingRef.current) {
        return;
      }

      void recover();
    },
    [recover],
  );

  useEffect(() => {
    const subscription = player.addListener(
      'playbackStatusUpdate',
      handleStatusUpdate as (status: AudioStatus) => void,
    );

    return () => {
      subscription.remove();
    };
  }, [player, handleStatusUpdate]);

  const start = useCallback(async () => {
    if (shouldSeekToStart(statusRef.current)) {
      await safeCall('Could not rewind to the start', () => player.seekTo(0));
    }

    const bound = await safeCall('Could not bind the lock screen session', () =>
      player.setActiveForLockScreen(true, LOCK_SCREEN_METADATA),
    );
    const resumed = await safeCall('Could not start playback', () => player.play());

    if (!bound || !resumed) {
      recoveryFailuresRef.current += 1;
    }
  }, [player, safeCall]);

  const pause = useCallback(() => {
    void safeCall('Could not pause playback', () => player.pause());
  }, [player, safeCall]);

  const toggle = useCallback(() => {
    // A user action always clears the recovery backoff.
    recoveryFailuresRef.current = 0;
    lastRecoveryAtRef.current = 0;

    if (statusRef.current?.playing) {
      wantPlayingRef.current = false;
      pause();
      return;
    }

    wantPlayingRef.current = true;
    void start();
  }, [pause, start]);

  return {
    playing: Boolean(status?.playing),
    wantPlaying: wantPlayingRef.current,
    toggle,
  };
}
