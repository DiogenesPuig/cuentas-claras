# D16 Saneamiento de dependencias (audit + tooling EOL)

**Sprint:** D (Mantenimiento) · **Modelo sugerido:** Opus (decide majors) → Sonnet (ejecuta) · **Depende de:** A1

## Objetivo
Resolver los avisos que dejó el scaffolding (A1): 4 advisories de `npm audit` (todas de la
cadena de tooling de dev) y la deprecación de ESLint 8 (end-of-life). Ninguno afecta el bundle
de producción, por eso no bloquean A1, pero conviene saldarlos en un cambio controlado.

## Contexto
- Todos los advisories vienen de **herramientas de desarrollo** (dev server / test runner), no
  del código que se sirve a usuarios. La app compilada (`vite build`) no incluye `esbuild`/`vitest`.
- El fix automático (`npm audit fix --force`) salta a **Vite 8** (breaking), por eso es una
  decisión de versión, no un parche trivial. Hay que elegir el salto y validar que todo siga verde.

### Problemas detectados (al cerrar A1, 2026-06-19)

| # | Paquete | Severidad | Qué es | Exposición real |
|---|---------|-----------|--------|-----------------|
| 1 | `esbuild` (≤0.24.2) | moderate | El dev server acepta requests de cualquier web y devuelve la respuesta (CORS laxo). GHSA-67mh-4wv8-2f99 | Solo con `npm run dev` corriendo y navegando a un sitio malicioso en la misma máquina. No afecta producción. |
| 2 | `vite` (≤6.4.2) | high | Path traversal en optimized deps `.map`, bypass de `server.fs.deny` y disclosure de hash NTLMv2 vía `launch-editor` (Windows). Hereda esbuild. | Dev server. Lectura de archivos fuera de root en escenarios concretos. No afecta producción. |
| 3 | `vite-node` (≤2.2.0-beta.2) | moderate | Hereda la vulnerabilidad de `vite`. Lo usa Vitest. | Solo en ejecución de tests. |
| 4 | `vitest` (≤3.2.5) | critical | Con la **UI server** de Vitest escuchando, se puede leer y ejecutar archivos arbitrarios. Hereda vite/vite-node. | Solo si se levanta `vitest --ui`/`--api` expuesto. **No lo usamos** (`npm test` = `vitest run`). |
| 5 | `eslint` 8.57.1 | (no es vuln) | ESLint 8 está **end-of-life**; v9 usa flat config (`eslint.config.js`) en vez de `.eslintrc.cjs`. | Solo mantenibilidad / soporte futuro. |

## Pasos
1. (Opus) Decidir los saltos de versión. Recomendado: **Vite 7 + Vitest 3 + @vitejs/plugin-react**
   compatibles (evaluar si Vite 8 ya es estable y vale el salto). Confirmar que `@testing-library`
   y `jsdom` siguen siendo compatibles.
2. Actualizar `package.json`, correr `npm install` y `npm audit` → objetivo **0 vulnerabilidades**.
3. Verificar que sobreviven el alias `@/`, el setup de tests y el tema de Tailwind.
4. (Opcional, puede ser ticket aparte) Migrar ESLint 8 → 9 (flat config): reemplazar
   `.eslintrc.cjs` por `eslint.config.js`, `typescript-eslint` v8, y mantener los mismos ignores
   (`database.types.ts`, `components/ui`) y la regla `react-refresh/only-export-components`.
5. Re-correr `typecheck`, `lint`, `test`, `build` y `dev`.

## Criterios de aceptación
- [ ] `npm audit` reporta 0 vulnerabilidades (o solo avisos justificados y documentados aquí).
- [ ] `typecheck`, `lint`, `test`, `build` siguen en verde y `npm run dev` levanta.
- [ ] No se rompe el alias `@/`, los tests ni los estilos de Tailwind/shadcn.
- [ ] Si se migra ESLint a v9, queda `eslint.config.js` y se borra `.eslintrc.cjs`
      (con su README/CLAUDE.md actualizados si corresponde).

## Fuera de alcance
- Cualquier feature de producto. Es puramente tooling/seguridad de dev.

## Por qué este modelo
Elegir un salto de major de la herramienta de build es una decisión cara de revertir (puede
romper el pipeline entero): la decide Opus. La ejecución mecánica del bump, una vez elegidas las
versiones, la puede hacer Sonnet.
