import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'
import reactHooks from 'eslint-plugin-react-hooks'

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    '.vercel/**',
    'node_modules/**',
    'playwright-report/**',
    'test-results/**',
    'src/payload-types.ts',
    'src/payload-generated-schema.ts',
  ]),
])
