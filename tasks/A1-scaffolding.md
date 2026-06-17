# A1 Scaffolding del proyecto

**Sprint:** A · **Modelo sugerido:** Sonnet · **Depende de:** —

## Objetivo
Crear el proyecto base (Vite + React + TS) con Tailwind, shadcn/ui, ESLint/Prettier, la estructura de carpetas del plan y los scripts de npm.

## Contexto
- `PLAN_TECNICO_FASE1.md` §1 (stack), §2 (estructura), §11 (convenciones), §13 (env).
- `CLAUDE.md` (reglas de código, comandos, DoD).

## Archivos a crear/editar
- Proyecto Vite React-TS en la raíz del repo.
- `tailwind.config.js`, `postcss.config.js`, `src/index.css` con Tailwind.
- `.eslintrc.cjs`, `.prettierrc`, `tsconfig.json` (con `strict: true` y alias `@/` → `src/`).
- Estructura vacía de carpetas: `src/app/{layout}`, `src/lib`, `src/features`, `src/components`, `src/hooks`, `src/types`.
- `.env.example` con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Inicializar shadcn/ui.
- Actualizar la sección "Comandos" de `CLAUDE.md` si difieren.

## Pasos
1. `npm create vite@latest . -- --template react-ts`.
2. Instalar y configurar Tailwind; importar en `src/index.css`.
3. Configurar alias `@/` en `vite.config.ts` y `tsconfig.json`.
4. ESLint + Prettier (+ husky + lint-staged opcional) con scripts `dev`, `build`, `typecheck`, `lint`, `test`.
5. `npx shadcn@latest init`.
6. Crear las carpetas con un `.gitkeep` donde haga falta.
7. App mínima que renderiza "Cuentas Claras" para verificar el arranque.

## Criterios de aceptación
- [ ] `npm run dev` levanta y muestra la pantalla mínima.
- [ ] `npm run typecheck` y `npm run lint` pasan sin errores.
- [ ] Alias `@/` funciona en un import de prueba.
- [ ] Tailwind aplica estilos; shadcn/ui inicializado.
- [ ] Existe la estructura de carpetas del plan.

## Fuera de alcance
- Cualquier pantalla real, auth o conexión a Supabase (tickets siguientes).

## Tests
- No aplica (setup). Solo que `npm test` corra el runner aunque no haya tests.

## Por qué este modelo
Sonnet: es setup mayormente mecánico pero con varias configs que deben quedar correctas (alias, strict, Tailwind, shadcn); conviene un modelo que no se equivoque en la integración. Si preferís abaratar, Haiku puede hacerlo siguiendo los pasos al pie de la letra.
