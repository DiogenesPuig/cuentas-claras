# D17 CI en GitHub Actions

**Sprint:** D (Mantenimiento) · **Modelo sugerido:** Sonnet · **Depende de:** A1

## Objetivo
Correr automáticamente los checks del proyecto (`typecheck`, `lint`, `test`, `build`) en cada Pull Request a `main` (y en push a `main`), para no depender de correrlos a mano antes de mergear. Red de seguridad ahora que se mergean PRs seguido.

## Contexto (links a docs)
- `CLAUDE.md` → comandos (`typecheck`/`lint`/`test`/`build`) y Definition of Done.
- `tasks/fase2/PLAN.md` §6 (origen de esta tarea).
- Stack: Node + Vite 8 (requiere Node ≥ 20.19 / 22.12). Local corre en Node 24; CI usa Node 22 LTS.

## Archivos a crear/editar
- `.github/workflows/ci.yml` (nuevo).
- `.github/workflows/README.md` (nuevo, índice de carpeta).
- `CLAUDE.md` (opcional): nota de que CI corre los checks en cada PR.

## Pasos
1. Workflow `CI` que dispara en `pull_request` a `main` y `push` a `main`.
2. Job en `ubuntu-latest`: checkout, `setup-node` (Node 22, cache npm), `npm ci`, y luego `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
3. Verificar que pasa en verde en un PR de prueba.

## Criterios de aceptación
- [ ] Un PR a `main` dispara el workflow y corre typecheck/lint/test/build.
- [ ] El workflow falla si cualquiera de esos checks falla (gate real).
- [ ] Usa `npm ci` (instalación reproducible desde el lockfile) y cachea dependencias.

## Fuera de alcance
- `pytest`/`ruff` del microservicio Python (se suma en F2-1, cuando exista).
- Deploy automático / CD (otro ticket si se quiere).
- `npm audit` como gate bloqueante (se puede sumar luego como check no bloqueante).

## Tests
- No aplica lógica pura; la validación es que el workflow corra verde en un PR.

## Por qué este modelo
Sonnet: configuración de CI acotada y estándar, sin decisiones de arquitectura.
