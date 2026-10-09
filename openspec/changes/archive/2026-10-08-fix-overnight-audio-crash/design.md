# Design

## Context

`src/components/AudioControl.tsx` is the entire playback surface: one `useAudioPlayer(AUDIO_FILE)` instance with `loop = true`, a one-shot `setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' })`, and a toggle handler that does `player.seekTo(0)` → `player.setActiveForLockScreen(true, meta)` → `player.play()` on every play tap. There is no player event subscription, no error handling around any player mutation, and no pause/intent distinction. `app.json` configures the `expo-audio` plugin with `enableBackgroundPlayback: true`.

Constraints observed from the expo-audio v56 API (https://docs.expo.dev/versions/v56.0.0/sdk/audio/):

- The only events an `AudioPlayer` emits are `playbackStatusUpdate` and `audioSampleUpdate` (`player.addListener()`). **There is no dedicated audio-interruption event** in this version — the "attach an interruption listener" idea from the issue report must be implemented via status-event handling plus guarded mutations.
- Lock-screen controls **require** `interruptionMode: 'doNotMix'`: *"For lock screen controls to work correctly, interruptionMode must be set to doNotMix."* Switching to `duckOthers` (exploration idea #1) would directly undermine the foreground-service keep-alive fix (#3).
- `setActiveForLockScreen(active, metadata)` exists and also has `updateLockScreenMetadata`; `player.loop` is a native-side property, so loop boundaries do **not** fire JS callbacks — the JS events that can arrive during/after Doze freeze are play-state status updates.
- The repo's existing `src/__tests__/AudioControl.test.tsx` is non-functional today (no jest dependency/config; it imports from `src/icons/` which doesn't exist).

See proposal.md for motivation; specs/background-audio-resilience/spec.md for requirements.

## Goals / Non-Goals

**Goals:**
- No unhandled JS exception or unhandled promise rejection can originate from a player interaction, at any point in the overnight cycle.
- Playback self-heals (resume + re-bind media session) after focus loss or unexpected stops, while an explicit user pause is never overridden.
- Constant resource footprint (1 player, bounded subscriptions) over arbitrarily long sessions.
- A reproducible device-side procedure (logcat + battery exemption) to confirm or eliminate the Doze/frozen-runtime and hardened_malloc hypotheses.

**Non-Goals:**
- No custom native (Kotlin/Swift) module, no replacement of expo-audio.
- No new playback features (timer, multiple tracks, volume UI).
- No change to visual layout or the `audio-centering` capability.
- Not attempting to programmatically control GrapheneOS battery policy (user-side setting; documented only).

## Decisions

### D1: Keep `interruptionMode: 'doNotMix'`; handle focus loss in JS instead of ducking
`duckOthers` was considered (issue exploration #1) but rejected: v56 requires `doNotMix` for `setActiveForLockScreen` to associate the media session (decision D4 depends on this), and a sleep-sounds app has no scenario where mixing is desirable. The residual risk — exclusive-focus loss forcing the player to stop — is handled by D2/D3 (status-driven recovery + guarded mutations) rather than by avoiding the interruption.

### D2: Extract a `useSleepAudio()` hook; `AudioControl` consumes it
Move player setup, audio-mode configuration, intent tracking, status subscription, and recovery logic out of the component into `src/hooks/useSleepAudio.ts`, exposing `{ playing, toggledByUser, toggle() }`.
- Why: the recovery state machine (user intent vs. observed status, re-assert throttling) is logic, not rendering; a hook makes it unit-testable against a mocked `expo-audio` and keeps `AudioControl` presentational.
- Alternative considered: keep everything inline in `AudioControl.tsx` — smaller diff, but the state machine would only be testable via full-component renders, and the existing component test is already broken.

### D3: Model user intent explicitly; recover via `playbackStatusUpdate`
The hook keeps `wantPlaying` (last explicit user action). Subscription: `player.addListener('playbackStatusUpdate', handler)` (removed on unmount via the returned subscription's `remove()`).
Handler rules:
- If `!status.playing && wantPlaying` → schedule a guarded recovery (re-assert `setActiveForLockScreen(true, META)` then `play()`), throttled to at most one recovery per ~2 s with a small retry cap (e.g., give up after 5 consecutive failures and log) so a permanently blocked session cannot produce a hot loop of bridge calls.
- If `status.playing` → clear failure counters.
- If the user paused (`wantPlaying === false`) → never recover.
Why: this is the only in-JS signal available in v56 for "the OS stopped us" and doubles as the media-session re-bind trigger (D4) and the frozen-runtime resume path (events queued during Doze are processed safely because every call is guarded, D5).
Alternative: polling with `setInterval` — rejected (adds timers the memory-leak requirement #4 warns about, and status events already exist).

### D4: Lock-screen binding applied once per playback start, idempotently re-asserted
`setActiveForLockScreen(true, META)` with module-level constant metadata is called when playback starts (first play after mount or after a user pause) and again by the recovery path. It is never called on every loop boundary and `setActiveForLockScreen(false)` is not called on pause (the service/notification teardown is left to expo-audio/Android so the user can resume from the notification). This makes the binding survive an overnight media-session reset while keeping bridge traffic constant-rate.

### D5: A single `safeCall` helper wraps every player mutation
All mutations (`play`, `pause`, `seekTo`, `setActiveForLockScreen`) go through one helper that `await`s the call inside try/catch, logs with a `[sleep-audio]` prefix, and returns success. Calls are serialized through an in-flight chain so a recovery triggered while the JS thread was frozen cannot interleave with a user tap landing on resume. `AudioStatus`-derived state updates (`useAudioPlayerStatus`) remain as the render source of truth.
Why: whichever hypothesis the logcat trace eventually confirms (bridge `IllegalStateException`, rejected promises on suspended runtime, hardened_malloc abort on native side), the JS-side failure mode "unhandled exception crashes the process" is eliminated unconditionally.

### D6: Resume in place; seek only when the track is truly at its end
`toggle()` → play path: only call `seekTo(0)` when `status.isLoaded && status.time >= status.duration` (or position is unknown/zero). With `loop = true` the native player handles end-of-track; JS-initiated seek on every resume is removed. This satisfies the "resume preserves position" scenario and cuts avoidable bridge traffic.

### D7: Single player instance, module-constant resources, full subscription teardown
Player remains from a single `useAudioPlayer` call (never re-created; no `createAudioPlayer` anywhere). Audio file stays a `require`d module constant. No `setInterval` anywhere (see D3 alternative). The hook removes its listener subscription in the `useEffect` cleanup. This is the memory-hygiene requirement; the 6-hour hardened_malloc hypothesis is then validated/eliminated via the logcat procedure rather than by code changes.

### D8: Verification harness — jest + mocked expo-audio, and a device procedure
- Add `jest` + `jest-expo` + `@testing-library/react-native` (dev-only) with a minimal config and a proper `expo-audio` mock factory, and rewrite `src/__tests__/AudioControl.test.tsx` (currently broken) plus a new `useSleepAudio` test covering: focus-loss status event → recovery called; user pause → no recovery; native throw → no unhandled rejection; resume → no `seekTo(0)`.
  - Alternative: no unit tests, device-only verification — rejected because the recovery state machine is exactly the logic that must not regress nightly.
- Document in `README.md`: `adb logcat -G 16M` → overnight `adb logcat -v threadtime > sleep.log` capture, `adb bugreport` as fallback, the GrapheneOS setting (Settings → Apps → SleepingBean/OpenSleepSounds → Battery → Unrestricted, plus doze whitelist `adb dump-device` free `adb deviceidle whitelist +com.workspace`), and what patterns to grep for (`F DEBUG`, `hardened_malloc`, `IllegalStateException`, `AudioFocus`).

### D9: Keep manifest/plugin config as-is, but verify prebuild output
`expo-audio`'s `enableBackgroundPlayback: true` is the documented setup; after `npx expo prebuild --platform android`, confirm the merged manifest contains `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MEDIA_PLAYBACK` (the docs list these for manual projects). If missing, add them via a minimal config plugin or `expo-build-properties` — verification task, not a speculative change.

## Risks / Trade-offs

- [Recovery fights the system: re-calling `play()` after a legitimate stop (e.g., phone call the user expects to interrupt audio) could hijack focus back] → Recovery is throttled and capped (D3); after cap exhaustion the app stays quiet until the next user action. Focus-loss-then-end on Android normally resumes via audio-focus replay, and our handler re-plays only when the OS already told us we stopped.
- [`playbackStatusUpdate` may not fire at all in some interruption paths (silent native stop)] → The app keeps playing-or-stopped without crashing (guarded mutations still apply); the logcat procedure is the fallback diagnostic, and a future low-frequency status sync could be added without changing the spec.
- [`doNotMix` retained means other apps get paused when a 2 AM system chime competes] → Accepted trade-off for guaranteed lock-screen/media binding; sleep-sounds usage has no mixing scenarios.
- [Adding jest to a repo with no test toolchain could stall on Docker/CI wiring] → Tests are dev-only; the fix itself ships independently. If jest-expo setup proves incompatible in the Docker builder, tests can be deferred while tasks 1–6 land (noted in tasks).
- [Root cause may be purely native (hardened_malloc abort) and untouched by JS fixes] → The proposal's scope deliberately includes the telemetry procedure so the same change produces the evidence for a follow-up native fix if needed.

## Migration Plan

Ship in one change; no data/migration concerns. Rollback = revert the `AudioControl.tsx`/`useSleepAudio.ts` commit (behavior returns to current code). Deploy path is the existing `task expo-build` APK flow. The README/device-procedure docs are additive.

## Open Questions

- Exact recovery retry cap/backoff values (2 s / 5 retries chosen as starting point; tunable constants, no spec impact).
- Whether GrapheneOS's media-notification lifecycle needs any `expo-audio` upgrade — defer until the logcat trace identifies a versioned native stack.
