# B10 Movimientos: lista + filtros + búsqueda

**Sprint:** B · **Modelo sugerido:** Sonnet · **Depende de:** B8

## Objetivo
Pantalla de movimientos con búsqueda por texto, filtros (mes, persona, tarjeta, categoría, moneda) y acciones de editar/eliminar.

## Contexto
- `PRD.md` §5.3 (FR-11), §5.6.
- `wireframes/wireframes_fase1.html` pantalla 4.
- `PLAN_TECNICO_FASE1.md` §5 (listTransactions con filtros).

## Archivos a crear/editar
- `src/features/transactions/components/` → `TransactionList`, `TransactionRow`, `FilterBar`, `SearchBar`.
- `src/app/` → `TransactionsPage` (ruta `/movimientos`).

## Pasos
1. `FilterBar`: mes (del período), persona (holder/miembro), tarjeta, categoría, moneda. Estado de filtros en URL o store.
2. `SearchBar`: filtra por `description` (server-side `ilike` o client-side si el set es chico).
3. `TransactionList`: muestra total filtrado y filas con persona·medio·fecha·monto.
4. Tocar una fila → editar (reusa `TransactionForm`) / eliminar (con permiso).

## Criterios de aceptación
- [ ] Los filtros combinan correctamente y actualizan el total.
- [ ] La búsqueda por texto funciona.
- [ ] Editar/eliminar respeta permisos.
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- Export (ticket C14).

## Tests
- Test de la función que arma los filtros para la query (mapeo filtros→args).

## Por qué este modelo
Sonnet: lista con filtros combinables; lógica acotada pero con detalle de UX.
