# Tasks

## 1. Test harness (prerequisite for verified logic)

- [x] 1.1 Add dev dependencies (`jest`, `jest-expo`, `@testing-library/react-native`, `@types/jest`) and a minimal jest config (`preset: jest-expo`, jsdom/node as appropriate) with an `npm test` script; verify `npm test` runs and exits cleanly on the existing suite location inside the Docker dev container (`task expo-dev` toolchain or local `npm`).
## 2. Resilient playback hook (`src/hooks/useSleepAudio.ts`)

- [x] 2.1 Create `useSleepAudio()` implementing audio-mode setup (`playsInSilentMode`, `shouldPlayInBackground`, `interruptionMode: 'doNotMix'` kept per design D1) with setup failures caught and logged under a `[sleep-audio]` prefix; verify by a unit test that a rejected `setAudioModeAsync` produces no unhandled rejection and logs the prefix.
- [x] 2.2 Implement the `safeCall` helper (design D5): awaits each player mutation (`play`, `pause`, `seekTo`, `setActiveForLockScreen`) inside try/catch, logs failures, serializes calls through an in-flight chain; verify with unit tests that a throwing `play`/`setActiveForLockScreen` mock is caught, logged, and leaves subsequent calls executable.
- [x] 2.3 Implement user-intent tracking (`wantPlaying`) and the `playbackStatusUpdate` subscription with recovery path: on `!status.playing && wantPlaying`, re-assert `setActiveForLockScreen(true, META)` then `play()`, throttled (~2 s) and capped (5 consecutive failures, then quiet until next user action); on `status.playing`, reset counters; on explicit user pause, never recover; remove the subscription on unmount. Verify with unit tests covering all four branches, the retry cap, and listener removal on unmount.
- [x] 2.4 Implement play/pause semantics per design D6: resume continues from current position (no `seekTo(0)` unless the track is loaded and at/past its end), `loop = true` set once per player instance; verify with unit tests asserting `seekTo` is not called on a mid-track resume and that the same player instance is reused across toggles.

## 3. Wire `AudioControl` to the hook

- [x] 3.1 Replace the inline player logic in `src/components/AudioControl.tsx` with `useSleepAudio()` (`{ playing, toggle }`), keeping the existing layout, icons, theming, and `audio-centering` behavior unchanged; verify the app renders and the play/pause icon still reflects `status.playing` via a component test, and manual tap starts/stops audio in the dev client.
- [x] 3.2 Replace the broken `src/__tests__/AudioControl.test.tsx` with working tests against a centralized `expo-audio` mock (correct `src/components`/icon paths, `jest.mock` hoisted at module scope); verify the full suite passes (`npm test`) with no obsolete snapshots left stale.

## 4. Configuration verification & device diagnostic docs

- [x] 4.1 Run `npx expo prebuild --platform android` (Docker builder) and inspect the merged `AndroidManifest.xml` for `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` plus the media-playback foreground service entries injected by the `expo-audio` plugin; if absent, add them via a minimal config plugin and re-verify by re-running prebuild and grepping the manifest.
- [x] 4.2 Add an "Overnight crash diagnosis" section to `README.md` documenting: battery-usage setting path on GrapheneOS (Settings → Apps → the installed app → Battery → Unrestricted), `adb deviceidle whitelist +com.workspace`, logcat setup/capture (`adb logcat -G 16M`, `adb logcat -v threadtime > sleep.log` overnight, `adb bugreport` fallback), and grep patterns (`hardened_malloc`, `F DEBUG`, `IllegalStateException`, `AudioFocus`); verify every referenced setting path, package id, and command matches the current app config (`app.json` package `com.workspace`) and reads correctly as written.

## 5. Integration verification

- [x] 5.1 Run `npx tsc --noEmit` and `npm test` with zero errors, and `npx expo export` (or `task expo-build`) succeeds, confirming no type/build regressions from the hook extraction and test harness.
- [ ] 5.2 On a device (preferably GrapheneOS): start playback, lock the screen, trigger a focus steal (play a video/phone-call simulation), confirm audio auto-resumes without crash and the lock-screen notification persists; then run one overnight (~6 h) session with the battery exemption applied and logcat capturing, and grep the log for the patterns from 4.2 with no app-process fatal; record findings (crash eliminated vs. native evidence for follow-up) in the README section from 4.2.
