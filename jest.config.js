/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testPathIgnorePatterns: [ "dist" ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1"
  }
};