module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Test file patterns
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],

    // Coverage settings
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        'commands/**/*.js',
        'handlers/**/*.js',
        'utils/**/*.js',
        'events/**/*.js',
        '!**/__tests__/**',
        '!**/node_modules/**',
        '!coverage/**'
    ],

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],

    // Module path mapping
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1'
    },

    // Test timeout
    testTimeout: 10000,

    // Verbose output
    verbose: true,

    // Clear mocks between tests
    clearMocks: true,

    // Force exit after tests
    forceExit: true,

    // Detect open handles
    detectOpenHandles: true
};
