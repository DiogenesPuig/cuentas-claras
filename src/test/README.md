# src/test

Configuración del entorno de pruebas (Vitest + Testing Library).

## Archivos

- `setup.ts` — importa `@testing-library/jest-dom` (matchers como `toBeInTheDocument`).
  Se carga vía `test.setupFiles` en `vite.config.ts`.
