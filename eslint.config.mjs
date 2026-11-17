import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores: ['dist/**', 'storybook-static/**', 'node_modules/**', 'coverage/**']},
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {globals: {...globals.node, ...globals.browser}},
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended],
    languageOptions: {globals: {...globals.browser, ...globals.node, ...globals.jest}},
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {ignoreRestSiblings: true}],
      'no-console': 'error',
    },
  },
);
