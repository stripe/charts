// Catch calendar dates accidentally formatted in the viewer's time zone.
process.env.TZ = 'America/Los_Angeles';

module.exports = {
  watchman: false,
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/tests/**/*.test.js'],
  moduleNameMapper: {'^src/(.*)$': '<rootDir>/src/$1'},
  transform: {
    '^.+\\.tsx?$': ['@swc/jest', {
      jsc: {target: 'es2020', parser: {syntax: 'typescript', tsx: true}},
    }],
  },
  clearMocks: true,
};
