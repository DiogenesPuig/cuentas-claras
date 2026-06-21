module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  ignorePatterns: [
    'dist',
    'coverage',
    '.eslintrc.cjs',
    // Generado por supabase gen types (no se edita ni se lintea a mano).
    'src/lib/database.types.ts',
    // Componentes copiados por shadcn/ui (se mantienen tal cual upstream).
    'src/components/ui',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
  overrides: [
    {
      // Edge functions corren en Deno (no en el bundle del front): exponen el
      // global `Deno` y se importan por URL/npm-specifier. Solo ajustamos el
      // global para que `no-undef` no falle; la lógica pura (parse.ts) se lintea
      // igual que el resto.
      files: ['supabase/functions/**/*.ts'],
      globals: { Deno: 'readonly' },
    },
  ],
};
