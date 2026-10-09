# Design: swap-app-name

## Context

The AudioControl component previously displayed the app name as a hardcoded Text component with "OpenSleepSounds". This approach lacked scalability and visual fidelity. The logo is now implemented as a dedicated React component, `src/components/AppNameLogo.tsx`, which renders the logo artwork directly using `react-native-svg` elements. The component itself - not an `assets/*.svg` file - is the single source of truth for the app name logo.

## Goals / Non-Goals

**Goals:**
- Render the app name in AudioControl via the `AppNameLogo` component
- Keep the logo artwork as flattened React Native SVG elements (no `<g>` tags) inside `AppNameLogo.tsx`
- Allow AudioControl to size and color the logo via props so it inherits theme colors
- Avoid any runtime dependency on SVG asset files

**Non-Goals:**
- No SVG optimization or minification tooling
- No changes to the component's surrounding layout beyond placing the logo
- No additional libraries beyond the existing `react-native-svg` dependency
- No reintroduction of an `assets/app-name-500.svg` file

## Decisions

**Approach:**
1. `AppNameLogo.tsx` owns the logo artwork: a `react-native-svg` `<Svg>` (viewBox `0 0 540 108`) containing only shape elements (`<Path>`, and `<Rect>` if needed), with no `<g>` wrappers
2. The component exposes props: `width` (height derived at `width / 5` to preserve aspect ratio), `color` (applied as the shape `fill`), and `style`
3. `AudioControl` renders `<AppNameLogo width={width * 0.7} color={theme.colors.textSecondary} style={styles.logo} />` in place of the old Text component, positioned absolutely near the top of the card
4. If the logo artwork ever changes, the paths in `AppNameLogo.tsx` are edited directly; git history serves as the reference

**Technical Considerations:**
- `react-native-svg` is already a project dependency, so no new dependencies are required
- Coordinate transforms and styles must live on individual shape elements, since group wrappers are not used
- Passing the theme color as a prop (rather than a hardcoded fill) keeps the logo compatible with light/dark themes

**Risks / Trade-offs:**
- [Maintenance] The artwork exists only as path data in TSX; there is no separate design source file in the repo
  - Mitigation: `AppNameLogo.tsx` is documented as the source of truth; changes are tracked in git
- [Verification] Visual diffs against an original SVG file are not possible
  - Mitigation: Compare rendered output against the design reference when modifying the paths

## Migration Plan

1. Implement `AppNameLogo.tsx` with the flattened SVG structure (no `<g>` tags)
2. Replace the Text component in `AudioControl.tsx` with `AppNameLogo`, passing theme color and size
3. Remove any reliance on `assets/app-name-500.svg` (no asset file is bundled or referenced)
4. Verify the logo renders correctly and inherits theme colors

## Open Questions

None.
