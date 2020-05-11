const path = require('path')

module.exports = {
  preset: 'ts-jest',
  // setupFilesAfterEnv: ['./test/test-setup.js'],
  testMatch: [path.resolve(__dirname, 'test/**/*.spec.ts')],
  globals: {
    'ts-jest': {
      packageJson: 'package.json'
    }
  }
}
