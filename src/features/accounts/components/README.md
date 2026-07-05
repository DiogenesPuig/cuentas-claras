# src/features/accounts/components

- `AccountList.tsx` — lista plana de medios/tarjetas (extensiones marcadas); alta/edición solo
  para owner/admin.
- `AccountForm.tsx` — form de alta/edición de un medio (banco, red, tipo, moneda, últimos 4,
  holder, extensión + titular, día de cierre).
- `AccountForm.test.tsx` — smoke tests: nombre requerido, holder=miembro exige elegir uno y setea
  `owner_member_id`, extensión exige tarjeta titular.
- `HolderAliasesEditor.tsx` — gestión de nombres alternativos (alias) del titular de un medio
  `'transfer'` (MEJ-4): chips con quitar + input para agregar. Solo matching futuro (no fusiona
  movimientos). Se muestra en `AccountList` bajo cada medio `'transfer'` (owner/admin).
