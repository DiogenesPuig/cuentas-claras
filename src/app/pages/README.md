# src/app/pages

Pantallas de dominio, una por ruta de `router.tsx` (o delegada por un gate de `../gates/`).

## Archivos

- `OnboardingPage.tsx` — pantalla `/onboarding`: pide nombre del usuario, nombre del grupo y
  moneda base; crea el primer workspace (A4).
- `OnboardingPage.test.tsx` — smoke test de validación del form de onboarding.
- `GroupsLanding.tsx` — landing para elegir grupo cuando hay más de uno (tarjetas + "Nuevo grupo"
  + salir); al entrar a un grupo lo activa y va a `/reportes`. Sin barra de secciones. Delegada por
  `../gates/HomeGate.tsx` (no está directamente en el router).
- `CategoriesPage.tsx` — pantalla `/categorias`: gestión de categorías del workspace activo (B6).
- `AccountsPage.tsx` — pantalla `/medios`: gestión de tarjetas/medios del workspace activo (B7).
- `TransactionsPage.tsx` — pantalla `/movimientos`: única página de carga de datos. Alta/edición/
  borrado de movimientos (manual o por comprobante/OCR, B8) **e importación de resúmenes** de
  tarjeta (`StatementImport`, FR-16/F2-3) — dos acciones inline mutuamente excluyentes — + lista con
  búsqueda (`SearchBar`, debounced) y filtros combinables (`FilterBar`) sobre el mes activo (B10).
- `ReportsPage.tsx` — pantalla `/reportes` (C13): bloque **general** (todo el grupo, tabs de
  dimensión; gráfico izq. / info der.), **detalle por filtro** (filtros apilables persona/banco/
  medio/categoría → subconjunto con "ver por"; info izq. / gráfico der.; vacío hasta filtrar),
  **mes a mes** (`BarChart`) y **anual** (acumulado del año). Usa `PersonaBreakdown`/`GroupBreakdown`
  para la info. Trae los movimientos del año/ventana en una sola query y agrega/consolida/filtra en
  el cliente con `features/reports` (sin lógica de datos propia).
- `GroupPage.tsx` — pantalla `/grupo`: miembros (`MemberList`), invitar por email/link
  (`InviteSection`) y configuración del workspace activo (`WorkspaceSettings`) (C15).
- `ProfilePage.tsx` — pantalla `/perfil` (MEJ-7): editar el nombre propio (global) vía
  `useMyProfile`/`useUpdateMyProfile`. Se accede desde el ícono de perfil del `Header`.
- `InviteAcceptPage.tsx` — pantalla `/invite/:token`: muestra a qué grupo/rol invita el token
  (`useInvitationPreview`) y lo acepta (`useAcceptInvitation`); rechaza tokens vencidos/inválidos
  (C15). No requiere `RequireWorkspace`: quien acepta puede no tener workspaces todavía.
- `InviteAcceptPage.test.tsx` — valida los tres casos: token usable (muestra y acepta), vencido o
  revocado (sin botón de aceptar), y token inexistente.
- `ProfilePage.test.tsx` — smoke test del form de edición de perfil.
