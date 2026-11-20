/** @type {import('jest').Config} */
const modulePathIgnorePatterns = ['<rootDir>/.desktop-app/', '<rootDir>/release/', '<rootDir>/dist/'];
const transformIgnorePatterns = [
  'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native|@tanstack/.*|zustand)',
];

module.exports = {
  projects: [
    {
      displayName: 'app',
      modulePathIgnorePatterns,
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      transformIgnorePatterns,
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // La entrada "react-native" de lucide es .mjs; en Jest se usa su build CommonJS.
        '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
        '^lucide-react-native/icons/(.*)$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
        '\\.ogg$': '<rootDir>/jest.asset-stub.js',
      },
    },
    {
      displayName: 'db',
      modulePathIgnorePatterns,
      testEnvironment: 'node',
      testMatch: ['<rootDir>/supabase/tests/**/*.test.ts'],
      transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
      transformIgnorePatterns: ['node_modules/(?!@electric-sql)'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
      testTimeout: 60000,
    },
  ],
};
