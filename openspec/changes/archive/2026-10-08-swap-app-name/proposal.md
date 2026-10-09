## Why

The App Name in AudioControl previously used a hardcoded Text component with "OpenSleepSounds". This has been replaced with the `AppNameLogo` component (`src/components/AppNameLogo.tsx`), which renders the app name logo as React Native SVG elements to provide a higher-quality, scalable logo that matches the design system. The logo artwork lives in the component itself; no `assets/*.svg` file is used or required.

## What Changes

- Replace the hardcoded Text component in AudioControl.tsx with the `AppNameLogo` SVG component
- `AppNameLogo.tsx` contains the flattened logo artwork (a `react-native-svg` `<Svg>` with `<Path>` elements) directly in code
- No `<g>` tags are used; only shape elements (path, rect) are rendered
- `AppNameLogo` accepts `width`, `color` (used as the fill), and `style` props so the logo inherits theme colors
- No SVG asset file dependency (the former `assets/app-name-500.svg` reference is obsolete)

## Capabilities

### New Capabilities
- `audio-control-svg-logo`: A new capability to render the app name logo using SVG elements in the AudioControl component

### Modified Capabilities

## Impact

- **AudioControl.tsx**: Renders the app name via `AppNameLogo` instead of a Text component
- **AppNameLogo.tsx**: New component owning the logo artwork (source of truth; no SVG asset file)
- No API changes or breaking changes
- Uses the existing `react-native-svg` dependency; no new dependencies
