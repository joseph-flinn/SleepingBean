## 1. Create the AppNameLogo component

- [x] 1.1 Create `src/components/AppNameLogo.tsx` rendering the app name logo with `react-native-svg`
- [x] 1.2 Define the logo artwork as flattened shape elements (no `<g>` tags) inside the component
- [x] 1.3 Preserve coordinate transforms and styling on individual elements
- [x] 1.4 Expose `width`, `color` (fill), and `style` props with aspect ratio preserved (`height = width / 5`)

## 2. Update AudioControl component

- [x] 2.1 Replace the hardcoded Text component with `<AppNameLogo />`
- [x] 2.2 Position the logo at the top center of the card
- [x] 2.3 Pass the theme color (`theme.colors.textSecondary`) as the logo fill

## 3. Remove SVG asset dependency

- [x] 3.1 Ensure no `assets/*.svg` file is referenced or bundled for the app name logo
- [x] 3.2 Document `AppNameLogo.tsx` as the source of truth for the logo artwork

## 4. Testing

- [ ] 4.1 Run existing tests to ensure no regressions
- [ ] 4.2 Add/verify a test asserting `AppNameLogo` renders within `AudioControl`
- [ ] 4.3 Check visual appearance matches the design reference in light and dark themes
- [ ] 4.4 Test on both iOS and Android platforms
