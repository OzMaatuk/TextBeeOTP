/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageProvider: 'v8',
  setupFiles: ['dotenv/config'],
  collectCoverageFrom: ['src/**/*.ts'],
};
