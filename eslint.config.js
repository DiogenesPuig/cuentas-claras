import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// Flat config (ESLint 9+). Reemplaza al viejo `.eslintrc.cjs`; mantiene las
// mismas reglas, ignores y el override de Deno para las edge functions.
export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      // Generado por supabase gen types (no se edita ni se lintea a mano).
      'src/lib/database.types.ts',
      // Componentes copiados por shadcn/ui (se mantienen tal cual upstream).
      'src/components/ui',
      // Microservicio Python (se lintea con ruff en su propio job); su .venv trae
      // .js vendorizados (urllib3/emscripten) que no son del front.
      'services/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Edge functions corren en Deno (no en el bundle del front): exponen el
    // global `Deno` y se importan por URL/npm-specifier. Solo ajustamos el
    // global para que `no-undef` no falle; la lógica pura (parse.ts) se lintea
    // igual que el resto.
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: { Deno: 'readonly' },
    },
  },
  // Debe ir último: apaga reglas de estilo que pelean con Prettier.
  prettier,
);
