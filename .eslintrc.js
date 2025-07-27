module.exports = {
    env: {
        node: true,
        es2021: true,
        jest: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    rules: {
    // Code style
        'indent': ['error', 4],
        'linebreak-style': ['error', 'unix'],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
    
        // Best practices
        'no-console': 'off', // Allow console for bot logging
        'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
        'no-var': 'error',
        'prefer-const': 'error',
        'eqeqeq': ['error', 'always'],
        'curly': ['error', 'all'],
    
        // Error prevention
        'no-undef': 'error',
        'no-duplicate-imports': 'error',
        'no-unreachable': 'error',
        'no-constant-condition': 'error',
    
        // Async/await
        'require-await': 'error',
        'no-async-promise-executor': 'error',
    
        // Security
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error'
    },
    globals: {
        'process': 'readonly',
        'Buffer': 'readonly',
        '__dirname': 'readonly',
        '__filename': 'readonly',
        'module': 'readonly',
        'require': 'readonly',
        'exports': 'readonly',
        'global': 'readonly'
    },
    ignorePatterns: [
        'node_modules/',
        'coverage/',
        'dist/',
        '*.min.js'
    ]
};
