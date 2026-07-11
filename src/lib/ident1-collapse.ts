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
  type: SharedType;
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
}

export interface CollapsePlan {
  placeholders: PlaceholderPlan[];
  memberAliasAdditions: MemberAliasAddition[];
  attributions: TxAttribution[];
  archiveAccountIds: string[];
  apodoRemaps: ApodoRemap[];
  resolutions: AccountResolution[];
  /** Advertencias no bloqueantes (medio compartido faltante, apodo sin medio que lo explique, etc.). */
  warnings: string[];
}

const isShared = (a: CollapseAccount): boolean => a.ownerMemberId === null && a.holderName === '';

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
  const legacy = accounts.filter((a) => !isShared(a));
  const legacyIds = new Set(legacy.map((a) => a.id));
  const hasShared = (type: SharedType): boolean =>
    accounts.some((a) => a.type === type && isShared(a));

  const warnings: string[] = [];

  // 1. Resolver cada medio legacy a un target (miembro existente o placeholder deduplicado).
  const placeholderByKey = new Map<string, PlaceholderPlan>();
  const memberAliasByMember = new Map<string, string[]>();
  const targetByAccount = new Map<string, { ref: string; kind: 'member' | 'placeholder'; name: string }>();
  const resolutions: AccountResolution[] = [];

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
      ref = tempId;
      kind = 'placeholder';
      name = acc.holderName.trim();
    }

    targetByAccount.set(acc.id, { ref, kind, name });
    resolutions.push({
      accountId: acc.id,
      holderName: acc.holderName,
      type: acc.type,
      targetRef: ref,
      targetKind: kind,
      targetName: name,
    });
  }

  // 2. Atribuir + repuntar los movimientos de medios legacy. Falta el medio compartido → warning.
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const attributions: TxAttribution[] = [];
  const neededShared = new Set<SharedType>();

  for (const tx of transactions) {
    if (!legacyIds.has(tx.accountId)) continue; // ya está en un medio compartido u otro
    const acc = accountById.get(tx.accountId);
    const target = targetByAccount.get(tx.accountId);
    if (!acc || !target) continue;
    neededShared.add(acc.type);
    attributions.push({
      txId: tx.id,
      ownerRef: tx.ownerMemberId ?? target.ref,
      sharedType: acc.type,
      keepExistingOwner: tx.ownerMemberId !== null,
    });
  }
  for (const type of neededShared) {
    if (!hasShared(type)) {
      warnings.push(`No existe el medio "${type}" compartido: el runner debe crearlo antes de repuntar.`);
    }
  }

  // 3. Remapear apodos MEJ-8 name:<clave> → member:<id> del target (drop si colisiona con uno existente).
  const memberApodoKeys = new Set(
    apodos.filter((a) => a.personaKey.startsWith('member:')).map((a) => `${a.userId}|${a.personaKey}`),
  );
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
    if (!toRef) continue; // ningún medio legacy explica este apodo → se deja como está
    // El target final es un member:<id>. Para placeholders el runner sustituye el tempId por el id real.
    const collision = memberApodoKeys.has(`${apodo.userId}|member:${toRef}`);
    apodoRemaps.push({ userId: apodo.userId, fromKey: apodo.personaKey, toRef, collision });
  }

  const memberAliasAdditions: MemberAliasAddition[] = [...memberAliasByMember.entries()].map(
    ([memberId, aliases]) => ({ memberId, aliases }),
  );

  return {
    placeholders: [...placeholderByKey.values()],
    memberAliasAdditions,
    attributions,
    archiveAccountIds: legacy.map((a) => a.id),
    apodoRemaps,
    resolutions,
    warnings,
  };
}
