module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/?(*.)+(spec|test).[tj]s'],
  testTimeout: 130_000,
  // Register a process 'exit' handler to close better-sqlite3 handles before
  // the V8 isolate is torn down. Prevents SIGABRT / exit-134 on Node 24 when
  // fake-timers in shutdown.test.ts interact with the native addon GC.
  setupFilesAfterEnv: ['<rootDir>/tests/jestSetup.ts'],
  globalTeardown: '<rootDir>/tests/global-teardown.ts',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        target: 'ES2020',
        module: 'commonjs',
        resolveJsonModule: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@stellar/stellar-sdk$': '<rootDir>/__mocks__/@stellar/stellar-sdk.js',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
