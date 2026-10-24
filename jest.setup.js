// Pure-logic tests only; native modules are mocked where imported.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-vision-camera', () => ({}), { virtual: true });
jest.mock('react-native-fast-tflite', () => ({ loadTensorflowModel: jest.fn() }), { virtual: true });
jest.mock('vision-camera-resize-plugin', () => ({}), { virtual: true });
jest.mock('expo-file-system', () => ({ File: class {}, Directory: class {}, Paths: { cache: '', document: '' } }), { virtual: true });
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }), { virtual: true });
