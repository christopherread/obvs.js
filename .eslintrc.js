module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: './tsconfig.eslint.json',
      tsconfigRootDir: __dirname,
    },
    plugins: [
      '@typescript-eslint',
    ],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
    ],
    rules: {
      'semi-style': ['error', 'last'],
      'quotes': ['error', 'single'],
      '@typescript-eslint/ban-ts-comment': 0,
    },
  };