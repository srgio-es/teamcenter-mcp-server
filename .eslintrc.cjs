module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es6: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off', // Turning off any warnings for now
    '@typescript-eslint/no-unused-vars': ['error', { 
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_' 
    }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: ['build/', 'dist/', 'node_modules/', 'coverage/'],
  overrides: [
    {
      files: ['teamcenter-client/src/logger.ts'],
      rules: {
        'no-console': 'off' // Allow console statements in logger.ts
      }
    },
    {
      files: ['teamcenter-client/**/*.ts'],
      rules: {
        // You can add specific rules for the teamcenter-client directory here if needed
      }
    }
  ]
};
