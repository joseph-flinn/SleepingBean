/**
 * A single serialized, non-throwing call helper for the sleep-audio player.
 *
 * Every player mutation goes through this so that a rejected native call can
 * never bubble out as an unhandled rejection (the crash path behind the
 * overnight silence bug), and so that calls cannot interleave: a recovery
 * attempt that lands after the JS thread thawed waits behind a user tap that
 * arrived at the same moment.
 */

export const SLEEP_AUDIO_LOG_PREFIX = '[sleep-audio]';

export type SafeCallLogger = (message: string, error: unknown) => void;

/**
 * Runs a player mutation and resolves with whether it succeeded. Calls are
 * queued behind whatever is already in flight.
 */
export type SafeCall = (label: string, invoke: () => unknown) => Promise<boolean>;

const defaultLogger: SafeCallLogger = (message, error) => {
  console.error(`${SLEEP_AUDIO_LOG_PREFIX} ${message}`, error);
};

export function createSafeCall(logger: SafeCallLogger = defaultLogger): SafeCall {
  let inFlight: Promise<unknown> = Promise.resolve();

  return function safeCall(label, invoke) {
    const run = async () => {
      try {
        await invoke();
        return true;
      } catch (error) {
        logger(`${label} failed`, error);
        return false;
      }
    };

    // Queue behind the previous call whether it succeeded or failed.
    const result = inFlight.then(run, run);
    inFlight = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  };
}
