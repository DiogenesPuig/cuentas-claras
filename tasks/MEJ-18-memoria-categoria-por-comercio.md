# MEJ-18 Memoria de categoría por comercio (aprender de correcciones)

**Sprint:** Mejoras / ingesta · **Modelo sugerido:** Opus (cerrar diseño de datos/RLS) → Sonnet
(implementar) · **Depende de:** F2-6 (sugerencia por keyword, hecha), B6 (categorías), y encaja mejor
tras `IDENT-1` (no lo bloquea)

## Historia de usuario
> Como usuario, cuando cargo un gasto leyendo un **comprobante de transferencia** o un **resumen de
> tarjeta**, quiero poder **reasignar la categoría** de ese comercio/gasto y que, **la próxima vez que
> vuelva a aparecer ese mismo comercio**, se coloque automáticamente en la categoría que elegí.
>
> Ejemplo: gasto en **"marcoskiosco"**; la lectura automática por algún motivo lo categoriza mal (o no
> lo categoriza); yo lo corrijo a **Kiosco**. La próxima vez que lea una transferencia/resumen con ese
> comercio, se sugiere/asigna **Kiosco** solo.

## Objetivo
Que la app **aprenda de las correcciones del usuario**: mantener un mapa **comercio → categoría** por
workspace que se actualiza cada vez que se guarda un movimiento con texto de comercio, y que ese mapa
tenga **prioridad** sobre las reglas de keyword fijas de `F2-6` al sugerir la categoría.

## Decisiones cerradas con el usuario (2026-07-10)
1. **Alcance:** la memoria es **por workspace** (compartida por el grupo). Coherente con que el gasto es
   grupal y con el modelo RLS por workspace. No es por usuario.
2. **Cuándo aprende:** **al confirmar cualquier alta con texto de comercio** — import de resumen (F2-3),
   comprobante OCR y **alta manual** (B8). Toda vez que un movimiento con comercio se guarda con una
   categoría, se registra/actualiza la regla `comercio → categoría`.
3. **Prioridad:** la **regla aprendida gana** sobre las keywords fijas de `F2-6`. Si el usuario corrigió
   un comercio, su elección manda incluso sobre un keyword hardcodeado (ej. "pedidosya" que el usuario
   mandó a Supermercado gana sobre el keyword → Comida).

## Contexto (código real)
- `src/lib/category-suggest.ts` (F2-6): `suggestCategory(description, categories)` — motor **puro** por
  reglas de keyword (substring, case/acento-insensitive; gana la keyword más larga). Su función `norm()`
  (NFD + minúsculas + colapsar espacios) es la normalización a reutilizar como **clave de comercio**.
- Integraciones actuales de la sugerencia: el **staging de importación** (F2-3, precarga la categoría) y
  el **alta manual** (B8, botón "Usar"). Ahí es donde hay que enganchar el "aprender" y el "priorizar".
- `src/lib/payee.ts` ya reutiliza los keywords y la misma `norm()` — patrón a seguir (lógica pura,
  portable, sin red).
- **Portabilidad (CLAUDE.md):** el mapa vive en la DB pero **solo `api.ts` lo toca**; el match/merge de
  reglas es **lógica pura en `lib/`** (testeable, sin Supabase).

## DECISIÓN PENDIENTE (cerrar antes de implementar — Opus)
1. **Qué es la "clave de comercio".** Recomendado: el **texto de comercio normalizado** con `norm()`
   (el mismo de `category-suggest`). Para resúmenes/comprobantes, definir de qué campo sale (razón
   social / descripción cruda) y si se **recortan sufijos ruidosos** (números de cuota "C.01/06",
   códigos de referencia, `*`, ids). Empezar simple (comercio normalizado exacto); dejar el recorte de
   ruido como iteración. **No** usar fuzzy/substring en la v1 (una regla aprendida debe ser precisa,
   no arrastrar comercios parecidos).
2. **Match exacto vs. substring** al resolver. Recomendado v1: **igualdad de clave normalizada** (o que
   la descripción _contenga_ la clave aprendida, evaluándolo). Confirmar.
3. **Nombre de la tabla/columnas y unicidad.** Propuesta: `category_memory` (o `merchant_categories`):
   `workspace_id`, `merchant_key text` (normalizado), `category_id`, `updated_at`, `updated_by`.
   Único por `(workspace_id, merchant_key)` → el último que corrige **pisa** (upsert). Confirmar si el
   "último gana" es correcto o si preferimos algún desempate.
4. **Categoría borrada:** `category_id` con `on delete cascade` (se borra la regla) — confirmar.

## Modelo de datos (propuesta a cerrar en la DECISIÓN)
```
create table category_memory (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  merchant_key text not null,                 -- comercio normalizado (norm())
  category_id  uuid not null references categories(id) on delete cascade,
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, merchant_key)
);
```
- **RLS:** leer/escribir solo si sos miembro del workspace (mismo patrón que `categories`/`transactions`;
  reutilizar `is_member(workspace_id)`). No se debilita nada. La `category_id` debe pertenecer al **mismo
  workspace** (check/trigger, como en otras tablas).

## Diseño de resolución (lógica pura en `lib/`)
- Nueva función que combina memoria + keywords, ej. en `category-suggest.ts` o un `category-memory.ts`:
  `suggestCategoryWithMemory(description, categories, memory)` donde `memory: Map<merchantKey, categoryId>`.
  Orden: **1) memoria aprendida** (clave normalizada del comercio) → **2)** `suggestCategory` (keywords
  F2-6) → 3) nada. Puro y testeado; sin red.
- El "aprender" (upsert) es un efecto: vive en `api.ts` (`upsertCategoryMemory(workspaceId, merchantKey,
  categoryId)`), disparado al **guardar** un movimiento que tenga texto de comercio + categoría.

## Pasos
1. **(Opus)** Cerrar la DECISIÓN PENDIENTE (clave de comercio, match, tabla/unicidad, cascada).
2. **Migración:** `category_memory` + RLS (`is_member`) + check de mismo-workspace para `category_id`.
   Aplicar **local** primero; regenerar `database.types.ts`; remoto al final (DoD).
3. **`api.ts`** (feature `transactions` o `categories`, definir): `listCategoryMemory(workspaceId)` y
   `upsertCategoryMemory(workspaceId, merchantKey, categoryId)`. Únicos que tocan Supabase.
4. **`lib/` puro:** `suggestCategoryWithMemory(...)` (memoria gana, luego keywords) + extraer/compartir
   la normalización de comercio. Tests.
5. **Enganchar el "aprender"** al confirmar alta con comercio en: **staging de import (F2-3)**, **OCR de
   comprobante** y **alta manual (B8)**. Solo cuando hay texto de comercio y categoría elegida.
6. **Enganchar el "sugerir"**: reemplazar los llamados actuales a `suggestCategory` por la versión con
   memoria en los mismos puntos donde hoy se precarga la sugerencia.
7. Tests (`lib` puro obligatorio) + `typecheck`/`lint`/`test` verdes.

## Criterios de aceptación
- [ ] Al corregir manualmente la categoría de un movimiento con comercio (import/OCR/manual) y guardarlo,
      queda registrada la regla `comercio → categoría` en el workspace.
- [ ] Al **volver a cargar el mismo comercio** (transferencia/resumen), se **sugiere/precarga** la
      categoría aprendida, aun si un keyword fijo apuntaba a otra (la memoria **gana**).
- [ ] La memoria es **por workspace**: la ve/usa cualquier miembro; RLS no permite verla desde otro
      workspace.
- [ ] La sugerencia sigue siendo **editable** (nunca se aplica de forma irreversible; el usuario puede
      cambiarla, y al hacerlo actualiza la memoria).
- [ ] Comercio desconocido y sin keyword → no sugiere (no rompe).
- [ ] Migración aplicada en **remoto** + `database.types.ts`/`schema_fase1.sql` al día; RLS no se debilita.
- [ ] `lib/` con tests; `typecheck`/`lint`/`test` ok.

## Fuera de alcance
- **Editar/borrar** reglas aprendidas desde una pantalla de administración (evaluar como ticket aparte
  si hace falta; por ahora el "último que corrige, pisa" alcanza).
- **Fuzzy/agrupado** de comercios parecidos (ej. "marcoskiosco" vs "kiosco marcos") — v1 usa clave
  normalizada precisa; el agrupado inteligente/IA queda como mejora futura.
- Re-categorizar en masa movimientos históricos al crear una regla (los viejos quedan como están).
- IA/embeddings para la sugerencia (sigue fuera, como en F2-6).

## Por qué este modelo
Opus cierra el diseño de datos/RLS y la definición de "clave de comercio" (decisiones caras de revertir).
La implementación (tabla + `api.ts` + función pura con tests + enganches) es trabajo acotado para Sonnet.
