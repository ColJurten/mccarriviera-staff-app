import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      '.ai/**',
      'spikes/documenso/output/**',
      'spikes/documenso/.venv/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
);
