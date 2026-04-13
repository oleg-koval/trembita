// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' }
      ]
    }
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off'
    }
  },
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'eslint.config.js',
      'package-lock.json',
      'scripts/**'
    ]
  }
);
