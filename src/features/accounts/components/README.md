# src/features/accounts/components

- `AccountList.tsx` — lista plana de medios/tarjetas (extensiones marcadas); alta/edición solo
  para owner/admin.
- `AccountForm.tsx` — form de alta/edición de un medio (banco, red, tipo, moneda, últimos 4,
  holder, extensión + titular, día de cierre).
- `AccountForm.test.tsx` — smoke tests: nombre requerido, holder=miembro exige elegir uno y setea
  `owner_member_id`, extensión exige tarjeta titular.

_(IDENT-1 paso 4: el editor de alias de titular dejó de vivir en el medio; los alias son de la persona
y se editan en `/grupo` con `MemberAliasesEditor` —ver `features/workspaces/components`—.)_
