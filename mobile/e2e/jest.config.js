module.exports = {
    preset: 'detox',
    testRunner: 'jest-circus/runner',
    testTimeout: 180000,
    reporters: ['detox/runners/jest/streamlineReporter'],
    setupFilesAfterEnv: ['detox/runners/jest/index.js'],
};

