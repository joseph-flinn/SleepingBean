# Spec Delta

## Purpose

Ensures that sustained, unattended background audio playback (6+ hours, overnight) survives audio-focus interruptions, device sleep/runtime suspension, lock-screen media-session loss, and long-running resource pressure without crashing the app, self-healing playback where possible.

## ADDED Requirements

### Requirement: Playback survives audio focus interruption
The system SHALL handle audio-focus interruptions (another app requesting focus, system maintenance sounds, Doze entry, DND transitions) without terminating the application process and without raising unhandled exceptions to the user.

#### Scenario: Focus revoked during overnight playback
- **WHEN** the operating system or another app revokes this app's exclusive audio focus while audio is playing
- **THEN** the app process MUST remain alive
- **AND** playback state changes MUST NOT surface as unhandled rejections or crash dialogs

#### Scenario: Focus interruption event arrives while the app is suspended
- **WHEN** an audio interruption or player status event is delivered to the app while the JavaScript runtime was suspended by the operating system
- **THEN** the app MUST process or discard the event on resume without crashing

### Requirement: Automatic recovery of interrupted playback
While the user's intent is "playing", the system SHALL attempt to resume playback after an audio interruption ends or after the player is found stopped unexpectedly, without requiring user interaction.

#### Scenario: Interrupting audio finishes
- **WHEN** playback was interrupted by another audio source and the interruption ends
- **THEN** the system SHALL resume the looped audio automatically from where it stopped

#### Scenario: Unexpected stop detected
- **WHEN** the player reports a stopped state while the user's last explicit action was "play"
- **THEN** the system SHALL re-assert the active playback session and resume playback

#### Scenario: User pause is respected
- **WHEN** the user explicitly paused playback and the player reports a stopped state
- **THEN** the system MUST NOT resume playback automatically

### Requirement: Resilient player interactions
Every interaction with the audio player that crosses into native code (start, stop, seek, session/lock-screen binding) MUST be performed in a way that a native failure cannot produce an unhandled exception in the application, and failures MUST be recorded for diagnosis.

#### Scenario: Native call fails during a frozen or resuming runtime
- **WHEN** a player control invoked by the app fails because the native side is unavailable, suspended, or times out
- **THEN** the failure MUST be caught and logged
- **AND** the application process MUST remain alive and responsive

#### Scenario: Resume preserves position
- **WHEN** the user resumes playback after a manual pause
- **THEN** audio MUST continue from the paused position rather than restarting from the beginning of the track

### Requirement: Continuous lock-screen media session binding
While playback is active, the system SHALL maintain an active lock-screen media session binding for the playing audio, including re-establishing it if it is lost during background playback.

#### Scenario: Playback starts
- **WHEN** the user starts playback
- **THEN** the audio MUST be bound to the system media session with playback metadata so a system background-process killer treats the audio service as an active media playback service

#### Scenario: Media session binding lost overnight
- **WHEN** the lock-screen media session binding is lost or reset while the user expects playback to continue
- **THEN** the system SHALL re-establish the binding without user interaction

### Requirement: Bounded long-running playback resources
The system SHALL reuse a single audio player instance for the whole playback session and release all event subscriptions when the playback UI is torn down, so that hours of continuous looping do not accumulate player instances, listeners, or timers.

#### Scenario: Loop boundaries over many hours
- **WHEN** the audio loops continuously for 6 or more hours
- **THEN** the number of live player instances and event subscriptions for playback MUST remain constant (one player, its status subscriptions only)

#### Scenario: Playback UI unmounts
- **WHEN** the playback component is unmounted
- **THEN** all player event subscriptions created by the component MUST be released

### Requirement: Overnight diagnosis and device-configuration guidance
The project SHALL provide documented procedure to (a) capture an overnight `adb logcat` trace for crash root-cause analysis and (b) configure the device so battery optimization and Doze do not suspend the app during overnight playback (e.g., unrestricted battery usage / Doze exemption on GrapheneOS).

#### Scenario: Investigator follows the guide
- **WHEN** a developer or user follows the documented procedure on an Android device
- **THEN** a logcat file covering the overnight period is captured to a location stated in the guide
- **AND** the app is exempted from battery optimization so the guidance explicitly states how to test the "frozen runtime" hypothesis

#### Scenario: Guide accuracy
- **WHEN** the guide references app settings or plugin configuration
- **THEN** the referenced settings and configuration keys MUST exist in the current app configuration or Android/GrapheneOS UI
