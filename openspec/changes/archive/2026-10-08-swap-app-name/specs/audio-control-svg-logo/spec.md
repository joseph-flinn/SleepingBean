## ADDED Requirements

### Requirement: AudioControl component must render app name using the AppNameLogo component

The AudioControl component SHALL render the app name logo using the `AppNameLogo` component (`src/components/AppNameLogo.tsx`) instead of a Text component or an external SVG asset file.

#### Scenario: SVG logo renders correctly
- **WHEN** the AudioControl component is mounted
- **THEN** the app name logo is displayed at the top center of the component
- **THEN** the logo is rendered as React Native SVG elements defined in `AppNameLogo.tsx`
- **THEN** no `assets/*.svg` file is loaded or referenced at runtime

### Requirement: Logo artwork must live in AppNameLogo with a flattened structure

The app name logo artwork SHALL be defined directly in `AppNameLogo.tsx` using React Native SVG shape elements (path, rect, etc.), with no `<g>` tags.

#### Scenario: Flattened structure
- **WHEN** `AppNameLogo` renders
- **THEN** all shape elements are rendered directly under the root `<Svg>` element
- **THEN** no `<g>` tag wrappers are present
- **THEN** coordinate transforms and styles are preserved on individual elements

### Requirement: AppNameLogo must accept size, color, and style props

The `AppNameLogo` component SHALL accept `width`, `color`, and `style` props so callers can size the logo and apply theme colors.

#### Scenario: Theme colors are inherited
- **WHEN** AudioControl renders `AppNameLogo`
- **THEN** it passes the current theme color as the logo fill
- **THEN** it passes a width and preserves the logo's aspect ratio
- **THEN** the logo matches both light and dark themes
