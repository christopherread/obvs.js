module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: './tsconfig.json',
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
      '@typescript-eslint/ban-ts-comment': 0,
    },
  };