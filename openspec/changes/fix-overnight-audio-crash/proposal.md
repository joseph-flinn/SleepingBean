# Proposal

## Why

The app crashes in the middle of the night (~2–3 AM) on GrapheneOS devices while looping sleep audio for 6+ hours. The crash destroys the core value proposition — uninterrupted overnight playback — and the current implementation has no defensive handling for the conditions that arise during long unattended background playback: audio-focus loss, a JS runtime frozen by Doze while native events queue up, an unbound/lost lock-screen media session, and repeated bridge calls made blindly against a possibly-suspended player.

## What Changes

- Add interruption-aware, error-guarded player lifecycle handling in `AudioControl.tsx`: subscribe to the player's `playbackStatusUpdate` event (the only player event stream expo-audio v56 exposes) and treat every player mutation (`play`, `pause`, `seekTo`, `setActiveForLockScreen`) as fallible by wrapping it in guarded async calls so a rejected native call can never produce an unhandled exception.
- Stop re-issuing `seekTo(0)` on every resume: resume in place when the player already holds a loaded position, so night-time state transitions make fewer bridge calls.
- Make the lock-screen media-session binding (`setActiveForLockScreen(true, …)`) idempotent and re-assertable: applied once when playback starts, and re-asserted if a status update reveals the player stopped while the user still expects playback (focus loss / system media reset), instead of only being called on a manual play tap.
- Keep the player instance strictly singular (created once by `useAudioPlayer`, never re-created) and clean up all listeners on unmount, so no per-loop sound/player references accumulate for hardened_malloc to trip over.
- Keep `interruptionMode: 'doNotMix'` (the initial idea of switching to `duckOthers` conflicts with the v56 requirement that lock-screen controls need `doNotMix`; see design) and handle the focus-loss state transition in JS instead.
- Add a device-side verification/telemetry procedure: overnight `adb logcat` capture instructions and a documented GrapheneOS checklist (Battery → Unrestricted for the app, Doze/battery-optimization exemption) to isolate the native-bridge-frozen-during-Doze hypothesis.

## Capabilities

### New Capabilities
- `background-audio-resilience`: Guarantees that sustained overnight background audio playback survives audio-focus interruptions, JS-runtime suspension (Doze), lock-screen media-session loss, and long-running memory pressure without crashing the process, and that playback self-heals where possible.

### Modified Capabilities

- None. (`audio-centering` requirements are unchanged; the archived `background-audio-playback` requirements — continuous loop, background playback, manual control — are honored as-is and are strengthened, not changed, by the new resilience capability.)

## Impact

- **`src/components/AudioControl.tsx`**: player event subscription, guarded player mutations, idempotent lock-screen binding, resume-in-place behavior.
- **`README.md` (or a short docs section)**: GrapheneOS/Android battery-exemption and logcat capture procedure for overnight diagnosis.
- **No dependency changes**, no new packages, no native code changes; app.json already enables `expo-audio` background playback.
- **Risk**: re-asserting `setActiveForLockScreen` on unexpected stops must not fight the user's explicit pause — spec scenarios pin this behavior.
