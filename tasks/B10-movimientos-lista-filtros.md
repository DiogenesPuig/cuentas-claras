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
5. **Mover el filtro de mes al servidor (deuda heredada de B9).** Hoy `listTransactions(workspaceId)`
   trae *todos* los movimientos del workspace sin filtro y tanto el dashboard (B9) como esta pantalla
   filtran por mes en memoria (`occurred_on.startsWith(month)`). Extender `listTransactions` para que
   acepte el período (y el resto de filtros) y los aplique como `.gte/.lt occurred_on` en la query,
   de modo que B9 y B10 consuman el mismo set ya acotado.

   **Por qué:** filtrar en cliente obliga a descargar el histórico completo en cada carga y crece sin
   techo a medida que se acumulan movimientos → más datos por la red, más memoria y peor latencia
   percibida; además duplica la lógica de "qué cae en este mes" en cada pantalla. En B8/B9 era aceptable
   porque el volumen es chico y no había aún capa de filtros; B10 es justamente donde se construye esa
   capa, así que es el lugar natural para acotar en la DB (RLS ya garantiza el aislamiento por workspace;
   esto es solo eficiencia/consistencia, no seguridad).

## Criterios de aceptación
- [ ] Los filtros combinan correctamente y actualizan el total.
- [ ] La búsqueda por texto funciona.
- [ ] Editar/eliminar respeta permisos.
- [ ] El filtro de mes se aplica en la query (server-side), no en memoria; B9 consume el mismo set acotado.
- [ ] `typecheck`/`lint` ok.

## Fuera de alcance
- Export (ticket C14).

## Tests
- Test de la función que arma los filtros para la query (mapeo filtros→args).

## Por qué este modelo
Sonnet: lista con filtros combinables; lógica acotada pero con detalle de UX.
