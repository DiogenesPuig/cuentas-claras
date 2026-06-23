# F2-10 Reportes: deduplicar persona por miembro (owner_member_id)

**Sprint:** Fase 2 · **Modelo sugerido:** Sonnet · **Depende de:** C13, B7

## Objetivo
Que una misma persona **no aparezca dos veces** en los reportes cuando su nombre viene escrito distinto en cada banco (apellido+nombre vs nombre+apellido, con/sin tildes). La dimensión **"persona"** debe agrupar por **`owner_member_id`** (id estable del miembro, con su nombre vivo de `member_directory`) y caer a **`holder_name` normalizado** solo cuando el medio no está ligado a un miembro. **No toca el microservicio.**

## Contexto (links a docs)
- Decisión (charla 2026-06-23): **agrupar por `owner_member_id`**, fallback a `holder_name` normalizado.
- Hoy la dimensión persona agrupa por **string** `holder_name`: `src/features/reports/aggregate.ts` → `dimensionKeyFor('persona', tx)` devuelve `tx.account?.holder_name`. Por eso dos `holder_name` distintos del mismo dueño se cuentan separados.
- `db/schema_fase1.sql` → `accounts.owner_member_id` (miembro) y `holder_name`; `member_directory` (nombre vivo del miembro).
- Pendiente ya anotado en `src/features/accounts/README.md` ("Mostrar el holder por `owner_member_id`").
- `src/features/reports/api.ts` → `ReportTransactionView` (qué campos del `account` trae hoy; sumar `owner_member_id` si falta).
- `personaSpending`/`personaAccounts` también agrupan por holder string → alinear con el mismo criterio.
- Portabilidad: el agrupado vive en `lib`/`aggregate.ts` (puro); la resolución del nombre del miembro se pasa como dato (no Supabase dentro de la lógica pura).

## Archivos a crear/editar
- `src/features/reports/api.ts` → incluir `account.owner_member_id` en `ReportTransactionView` (y el nombre del miembro, resuelto vía `member_directory`, o un mapa `memberId→nombre` que arme la page).
- `src/features/reports/aggregate.ts` → `dimensionKeyFor('persona', …)` agrupa por una **clave de persona**: `member:<owner_member_id>` si existe, si no `name:<holder_name normalizado>`. La **etiqueta** mostrada usa el nombre vivo del miembro (mapa) o el `holder_name`. Ajustar `personaSpending` y, si corresponde, `personaAccounts`.
- `src/lib/` → helper de **normalización de nombre** (ordenar tokens, sacar tildes/iniciales) reutilizable (puede salir del mismo módulo que `account-match`/`member-match`).
- `src/app/ReportsPage.tsx` → pasar el mapa `memberId→nombre` (de `useMembersForHolder`/directory) a la agregación.
- READMEs de `reports` y `lib`.

## Pasos
1. Sumar `owner_member_id` (y nombre del miembro) al view de reportes.
2. Definir `personaKey(tx)` = `member:<id>` | `name:<normalizado>`; agrupar por esa clave; etiqueta legible aparte (nombre vivo del miembro o `holder_name`).
3. Aplicar el mismo criterio en `personaSpending` (y revisar `personaAccounts`).
4. Verificar que dos medios del mismo miembro (con `holder_name` distintos) caen en **un** grupo con el nombre del miembro.

## Criterios de aceptación
- [x] Dos medios del **mismo miembro** con `holder_name` escritos distinto aparecen como **una sola persona** en el donut/desglose y en `personaSpending`.
- [x] La etiqueta mostrada es el **nombre vivo** del miembro (no el `holder_name` denormalizado) cuando hay `owner_member_id`.
- [x] Medios **sin miembro** caen a `holder_name` **normalizado** (tildes/orden), sin fusionar personas realmente distintas.
- [x] Los totales por persona siguen sumando el total del período (no se pierden ni duplican movimientos).
- [x] `typecheck`/`lint`/`test` ok.

## Fuera de alcance
- Crear/atribuir medios desde comprobantes (F2-8/F2-9).
- Unificar/mergear medios existentes a mano (herramienta de administración) — futura mejora.

## Tests
- `aggregate.test.ts`: dos `holder_name` distintos con el **mismo** `owner_member_id` → un grupo; dos sin miembro con nombre invertido/tildes → un grupo por normalización; dos personas distintas no se fusionan; `personaSpending` con el criterio nuevo.

## Por qué este modelo
Sonnet: cambio acotado y bien definido sobre lógica pura ya testeada (`aggregate.ts`), con criterio de dedup ya decidido.
