import type { audioMock as audioMockSource } from '../../__mocks__/expo-audio';

type ExpoAudioMock = typeof audioMockSource;

/**
 * The mock instance the components under test actually talk to.
 *
 * `jest.mock('expo-audio')` maps that package name onto
 * `<root>/__mocks__/expo-audio.ts`. Requiring the mock by relative path from a
 * test file can hand out a second copy of the module, so we go through the
 * package name and borrow the types from the mock source.
 */
export const audioMock: ExpoAudioMock = (
  jest.requireMock('expo-audio') as { audioMock: ExpoAudioMock }
).audioMock;
