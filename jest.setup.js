/**
 * Shared Jest setup: mocks that every test file needs.
 */

// react-native-safe-area-context needs a provider (or its own mock) to report insets.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// react-native-svg renders native views that do not exist in the test renderer.
jest.mock('react-native-svg', () => {
  const React = require('react');

  const stub = (name) => {
    const Component = ({ children, testID }) =>
      React.createElement(name, { testID }, children);
    Component.displayName = name;
    return Component;
  };

  return {
    __esModule: true,
    default: stub('Svg'),
    Svg: stub('Svg'),
    Path: stub('Path'),
    Rect: stub('Rect'),
    Circle: stub('Circle'),
    G: stub('G'),
  };
});
