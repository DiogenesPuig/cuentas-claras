/**
 * IDENT-1 paso 5 — planificación (PURA) del backfill + colapso de medios transfer/cash por-persona.
 *
 * Hoy la persona de una transferencia/efectivo vive en el medio (uno por persona: `holder_name` /
 * `owner_member_id`). El modelo nuevo la pone en el movimiento (`transactions.owner_member_id`) y deja
 * UN solo medio "Transferencia" y uno "Efectivo" compartidos por workspace. Esta función calcula QUÉ
 * hay que hacer para migrar sin perder atribución histórica; NO toca la DB (eso es el cascarón/runner).
 *
 * Reusa la lógica ya testeada: `matchMember` (nombre + alias del miembro) y `normalizeNameKey`
 * (para deduplicar placeholders por nombre y para remapear los apodos MEJ-8 `name:<clave>`).
 *
 * Reglas de resolución de la persona de cada medio legacy:
 *  1. `ownerMemberId` seteado → ese miembro (tarjeta-de-persona ya vinculada).
 *  2. si no, `matchMember(holderName, members)` (conservador: ≥2 tokens o alias exacto) → ese miembro.
 *  3. si no → **placeholder** nuevo, deduplicado por `normalizeNameKey(holderName)` (varias
 *     "Transferencia Pepito" colapsan en una sola persona del grupo).
 *
 * Regla de "no ensuciar" (decisión 2026-07-11): un medio legacy **sin movimientos** que caería en un
 * placeholder NO crea la persona (no hay historia que preservar); solo se archiva. Los placeholders se
 * crean únicamente cuando hay ≥1 movimiento que atribuirles.
 *
 * Nunca borra: los medios legacy se **archivan** (conservan la historia; sus movimientos ya quedaron
 * repunteados al medio compartido con la persona en el movimiento).
 */

import { matchMember, type MatchableMember } from './member-match';
import { normalizeNameKey } from './name-match';

export type SharedType = 'transfer' | 'cash';

/** Miembro (real o placeholder) del workspace, con nombre vivo y alias (IDENT-1 paso 4). */
export interface CollapseMember extends MatchableMember {
  aliases: string[];
}

export interface CollapseAccount {
  id: string;
  /** 'transfer'/'cash' se colapsan; otros tipos (tarjetas) de no-miembros se enganchan a la persona. */
  type: string;
  ownerMemberId: string | null;
  /** '' en el medio compartido; nombre del titular en los legacy por-persona. */
  holderName: string;
  holderAliases: string[];
}

export interface CollapseTx {
  id: string;
  accountId: string;
  /** Puede venir ya seteado (se respeta y solo se repuntea el medio). */
  ownerMemberId: string | null;
}

/** Fila de `persona_aliases` (MEJ-8): apodo privado de un usuario. */
export interface CollapseApodo {
  userId: string;
  personaKey: string; // 'name:<clave>' | 'member:<id>'
}

export interface CollapseInput {
  members: CollapseMember[];
  /** TODOS los medios transfer/cash del workspace (compartidos + legacy). */
  accounts: CollapseAccount[];
  /** Movimientos cuyo medio es transfer/cash. */
  transactions: CollapseTx[];
  apodos: CollapseApodo[];
}

/** Placeholder a crear (persona del grupo sin cuenta). `tempId` referencia el plan antes del insert. */
export interface PlaceholderPlan {
  tempId: string;
  name: string;
  aliases: string[];
}

/** Alias a AGREGAR a un miembro existente (venían del `holder_aliases` de un medio legacy suyo). */
export interface MemberAliasAddition {
  memberId: string;
  aliases: string[];
}

/** Atribución + repunteo de un movimiento. `ownerRef` es un `memberId` o el `tempId` de un placeholder. */
export interface TxAttribution {
  txId: string;
  ownerRef: string;
  sharedType: SharedType;
  /** true si el movimiento ya tenía `owner_member_id`: no se pisa, solo se repuntea el medio. */
  keepExistingOwner: boolean;
}

/** Remapeo de un apodo MEJ-8 de `name:<clave>` a `member:<id>` del target resuelto. */
export interface ApodoRemap {
  userId: string;
  fromKey: string;
  toRef: string; // memberId o tempId de placeholder
  /** true si el usuario YA tiene un apodo para ese target: se descarta el `name:` (unique constraint). */
  collision: boolean;
}

/** Detalle legible para el dry-run: a dónde va cada medio legacy. */
export interface AccountResolution {
  accountId: string;
  holderName: string;
  type: SharedType;
  targetRef: string;
  targetKind: 'member' | 'placeholder';
  targetName: string;
  movements: number;
  /** `member`: se ata a un miembro · `placeholder`: crea persona · `archive-only`: sin mov, solo archiva. */
  action: 'member' | 'placeholder' | 'archive-only';
}

/** Enganche de un medio de no-miembro (ej. tarjeta) a la persona (miembro o placeholder), seteando
 *  `owner_member_id`. Así todos los medios de la misma persona se agrupan por identidad y no por texto
 *  (un mismo Miguel escrito distinto en cada tarjeta queda unido). NO archiva ni repuntea movimientos. */
export interface AccountOwnerUpdate {
  accountId: string;
  ownerRef: string; // memberId o tempId de placeholder
  holderName: string;
  targetName: string;
}

export interface CollapsePlan {
  placeholders: PlaceholderPlan[];
  memberAliasAdditions: MemberAliasAddition[];
  attributions: TxAttribution[];
  archiveAccountIds: string[];
  accountOwnerUpdates: AccountOwnerUpdate[];
  apodoRemaps: ApodoRemap[];
  resolutions: AccountResolution[];
  /** Advertencias no bloqueantes (medio compartido faltante, apodo sin medio que lo explique, etc.). */
  warnings: string[];
}

const isCollapsible = (a: CollapseAccount): boolean => a.type === 'transfer' || a.type === 'cash';
const isShared = (a: CollapseAccount): boolean =>
  isCollapsible(a) && a.ownerMemberId === null && a.holderName === '';
/** Medio de no-miembro que NO se colapsa (tarjeta suelta): candidato a engancharse a la persona. */
const isLinkCandidate = (a: CollapseAccount): boolean =>
  !isCollapsible(a) && a.ownerMemberId === null && a.holderName.trim() !== '';

/** Dedup case-insensitive conservando el primer casing; descarta vacíos. */
function mergeAliases(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const value = raw.trim();
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

export function planWorkspaceCollapse(input: CollapseInput): CollapsePlan {
  const { members, accounts, transactions, apodos } = input;

  const memberById = new Map(members.map((m) => [m.id, m]));
  const legacy = accounts.filter((a) => isCollapsible(a) && !isShared(a));
  const legacyIds = new Set(legacy.map((a) => a.id));
  const hasShared = (type: SharedType): boolean =>
    accounts.some((a) => a.type === type && isShared(a));

  const txCountByAccount = new Map<string, number>();
  for (const tx of transactions) {
    if (legacyIds.has(tx.accountId)) {
      txCountByAccount.set(tx.accountId, (txCountByAccount.get(tx.accountId) ?? 0) + 1);
    }
  }

  const warnings: string[] = [];

  // 1. Resolver cada medio legacy a un target (miembro existente o placeholder deduplicado).
  const placeholderByKey = new Map<string, PlaceholderPlan>();
  const memberAliasByMember = new Map<string, string[]>();
  const targetByAccount = new Map<string, { ref: string; kind: 'member' | 'placeholder'; name: string }>();
  const placeholderMovs = new Map<string, number>(); // tempId → total de movimientos de sus medios

  for (const acc of legacy) {
    let ref: string;
    let kind: 'member' | 'placeholder';
    let name: string;

    const linkedMember = acc.ownerMemberId ? memberById.get(acc.ownerMemberId) : undefined;
    const matched = linkedMember ?? matchMember(acc.holderName, members) ?? undefined;

    if (matched) {
      ref = matched.id;
      kind = 'member';
      name = matched.name;
      if (acc.holderAliases.length > 0) {
        memberAliasByMember.set(
          matched.id,
          mergeAliases(memberAliasByMember.get(matched.id) ?? [], acc.holderAliases),
        );
      }
    } else {
      // Placeholder deduplicado por nombre normalizado (o el nombre crudo si no da clave).
      const normKey = normalizeNameKey(acc.holderName) || acc.holderName.trim().toLowerCase();
      const tempId = `ph:${normKey}`;
      const existing = placeholderByKey.get(tempId);
      if (existing) {
        existing.aliases = mergeAliases(existing.aliases, acc.holderAliases);
      } else {
        placeholderByKey.set(tempId, {
          tempId,
          name: acc.holderName.trim(),
          aliases: mergeAliases(acc.holderAliases),
        });
      }
      placeholderMovs.set(tempId, (placeholderMovs.get(tempId) ?? 0) + (txCountByAccount.get(acc.id) ?? 0));
      ref = tempId;
      kind = 'placeholder';
      name = acc.holderName.trim();
    }

    targetByAccount.set(acc.id, { ref, kind, name });
  }

  // Placeholders que efectivamente se crean: solo los que tienen ≥1 movimiento (los medios vacíos que
  // caerían en un placeholder se archivan sin crear persona — regla de "no ensuciar").
  const usedPlaceholderIds = new Set(
    [...placeholderMovs].filter(([, n]) => n > 0).map(([id]) => id),
  );

  const resolutions: AccountResolution[] = legacy.map((acc) => {
    const t = targetByAccount.get(acc.id)!;
    const movements = txCountByAccount.get(acc.id) ?? 0;
    const action: AccountResolution['action'] =
      t.kind === 'member' ? 'member' : usedPlaceholderIds.has(t.ref) ? 'placeholder' : 'archive-only';
    return {
      accountId: acc.id,
      holderName: acc.holderName,
      type: acc.type as SharedType, // resoluciones son de medios legacy (transfer/cash)
      targetRef: t.ref,
      targetKind: t.kind,
      targetName: t.name,
      movements,
      action,
    };
  });

  // 2. Atribuir + repuntar los movimientos de medios legacy. Falta el medio compartido → warning.
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const attributions: TxAttribution[] = [];
  const neededShared = new Set<SharedType>();

  for (const tx of transactions) {
    if (!legacyIds.has(tx.accountId)) continue; // ya está en un medio compartido u otro
    const acc = accountById.get(tx.accountId);
    const target = targetByAccount.get(tx.accountId);
    if (!acc || !target) continue;
    const sharedType = acc.type as SharedType; // legacy ⇒ siempre 'transfer'|'cash'
    neededShared.add(sharedType);
    attributions.push({
      txId: tx.id,
      ownerRef: tx.ownerMemberId ?? target.ref,
      sharedType,
      keepExistingOwner: tx.ownerMemberId !== null,
    });
  }
  for (const type of neededShared) {
    if (!hasShared(type)) {
      warnings.push(`No existe el medio "${type}" compartido: el runner debe crearlo antes de repuntar.`);
    }
  }

  // 2b. Enganchar medios de no-miembro (tarjetas) a la persona: se matchean contra los miembros reales
  //     + los placeholders que sí se crean. Así el mismo Miguel escrito distinto en cada tarjeta queda
  //     bajo una sola identidad (por owner_member_id), inmune a las variantes del texto.
  const matchTargets: CollapseMember[] = [
    ...members,
    ...[...placeholderByKey.values()]
      .filter((p) => usedPlaceholderIds.has(p.tempId))
      .map((p) => ({ id: p.tempId, name: p.name, aliases: p.aliases })),
  ];
  const accountOwnerUpdates: AccountOwnerUpdate[] = [];
  for (const acc of accounts) {
    if (!isLinkCandidate(acc)) continue;
    const target = matchMember(acc.holderName, matchTargets);
    if (!target) continue;
    accountOwnerUpdates.push({
      accountId: acc.id,
      ownerRef: target.id,
      holderName: acc.holderName,
      targetName: target.name,
    });
  }

  // 3. Remapear apodos MEJ-8 name:<clave> → member:<id> del target (drop si colisiona con uno existente).
  //    Solo si el target se materializa: un miembro, o un placeholder que sí se crea (con movimientos).
  const memberApodoKeys = new Set(
    apodos.filter((a) => a.personaKey.startsWith('member:')).map((a) => `${a.userId}|${a.personaKey}`),
  );
  const validRefs = new Set<string>([...members.map((m) => m.id), ...usedPlaceholderIds]);
  // clave normalizada → target ref (para casar el apodo con el medio que resolvió a esa persona).
  const targetByNameKey = new Map<string, string>();
  for (const acc of legacy) {
    const t = targetByAccount.get(acc.id);
    const k = normalizeNameKey(acc.holderName);
    if (t && k) targetByNameKey.set(k, t.ref);
  }

  const apodoRemaps: ApodoRemap[] = [];
  for (const apodo of apodos) {
    if (!apodo.personaKey.startsWith('name:')) continue;
    const nameKey = apodo.personaKey.slice('name:'.length);
    const toRef = targetByNameKey.get(nameKey);
    if (!toRef || !validRefs.has(toRef)) continue; // sin medio, o el target no se materializa → se deja
    // El target final es un member:<id>. Para placeholders el runner sustituye el tempId por el id real.
    const collision = memberApodoKeys.has(`${apodo.userId}|member:${toRef}`);
    apodoRemaps.push({ userId: apodo.userId, fromKey: apodo.personaKey, toRef, collision });
  }

  const memberAliasAdditions: MemberAliasAddition[] = [...memberAliasByMember.entries()].map(
    ([memberId, aliases]) => ({ memberId, aliases }),
  );

  return {
    placeholders: [...placeholderByKey.values()].filter((p) => usedPlaceholderIds.has(p.tempId)),
    memberAliasAdditions,
    attributions,
    archiveAccountIds: legacy.map((a) => a.id),
    accountOwnerUpdates,
    apodoRemaps,
    resolutions,
    warnings,
  };
}
