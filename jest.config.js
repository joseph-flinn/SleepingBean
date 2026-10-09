/**
 * Minimal Jest setup for the Expo/React Native app.
 *
 * `jest-expo` pulls in the React Native preset, the Expo asset transformer
 * (so `require('*.wav')` keeps working) and platform resolution. The test
 * environment stays on the preset default (`node`) because
 * `@testing-library/react-native` renders through the test renderer rather
 * than a DOM.
 */
module.exports = {
  preset: 'jest-expo',
  // npm nests expo-modules-core under expo/ here, and jest-expo's setup requires
  // it by bare name; make that nested copy resolvable without touching deps.
  modulePaths: ['<rootDir>/node_modules', '<rootDir>/node_modules/expo/node_modules'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  clearMocks: true,
};
