process.env.AUTH_TOKEN_SECRET = 'test-secret';
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  coverageProvider: 'v8',
  setupFiles: ['dotenv/config'],
  collectCoverageFrom: ['src/**/*.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: false }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!oidc-provider)',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },
};
