// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt([
  {
    ignores: [
      '.nuxt/**',
      '.output/**',
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'public/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'warn',
    },
  },
  {
    files: ['plugins/msw.client.ts'],
    rules: {
      'no-console': 'off',
    },
  },
])
