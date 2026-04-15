/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageProvider: 'v8',
  setupFiles: ['dotenv/config'],
  collectCoverageFrom: ['src/**/*.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!oidc-provider)',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironmentOptions: {
    NODE_ENV: 'test',
  },
  globals: {
    'ts-jest': {
      useESM: false,
    },
  },
};
