const path = require('path');

module.exports = {
    preset: 'ts-jest',
    // testEnvironment: 'jsdom',
    // setupFilesAfterEnv: ['./test/test-setup.js'],
    testMatch: [path.resolve(__dirname, 'test/**/*.spec.ts')]
};
