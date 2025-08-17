module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts', 
    '**/?(*.)+(spec|test).ts',
    '**/tests/**/*.e2e.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '.*/__tests__/test-data/.*'
  ],
  // Transform TypeScript files
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: './tsconfig.test.json'
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Separate timeouts for different test types
  testTimeout: 30000, // Default timeout for unit tests
  // Override timeout for E2E tests - they use individual test timeouts
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Force exit to prevent hanging on resource leaks
  forceExit: true,
  // Detect open handles
  detectOpenHandles: false, // Disable to prevent noise in CI
};
