/**
 * IDENT-1 paso 5 — planificación (PURA) del backfill + colapso de medios transfer/cash por-persona +
 * unificación de identidad de los no-miembros. NO toca la DB (eso es el cascarón/runner).
 *
 * Hoy la persona de una transferencia/efectivo vive en el medio (uno por persona) y la de una tarjeta
 * de no-miembro se deduce de su `holder_name`. El modelo nuevo pone la persona en el movimiento
 * (`transactions.owner_member_id`) y deja UN solo "Transferencia"/"Efectivo" compartidos; cada persona
 * (miembro o placeholder) es una fila de `workspace_members`.
 *
 * Qué hace el plan, por workspace:
 *  1. **Agrupa** todos los medios de **no-miembro** (transferencia, efectivo y tarjetas) en personas,
 *     con el mismo match conservador de la app (`matchMember`: ≥2 tokens en común o alias exacto). Así
 *     "PUIG LUCAS, MIGUEL DOMINGO" (transfer) y "LUCAS MIGUEL PUIG" (tarjeta) caen en la misma persona,
 *     aunque el texto difiera. Primero intenta matchear a un **miembro real**; si no, forma un cluster
 *     (persona-placeholder).
 *  2. **Crea un placeholder** por cada persona-cluster con **≥1 movimiento** (regla "no ensuciar": los
 *     que no tienen ningún movimiento no crean persona).
 *  3. **Engancha** cada medio a su persona (`owner_member_id`): las tarjetas quedan (solo cambia el
 *     dueño); las de transferencia/efectivo se **archivan** y sus movimientos se **repuntean** al medio
 *     compartido con la persona en el movimiento.
 *  4. **Remapea** los apodos MEJ-8 `name:<clave>` → `member:<id>` de la persona resuelta.
 *
 * Nunca borra (archiva) y reusa `matchMember`/`normalizeName*` para no divergir del resto de la app.
 */

import { matchMember, type MatchableMember } from './member-match';
import { nameTokens, normalizeNameKey } from './name-match';

export type SharedType = 'transfer' | 'cash';

/** Miembro (real o placeholder) del workspace, con nombre vivo y alias (IDENT-1 paso 4). */
export interface CollapseMember extends MatchableMember {
  aliases: string[];
}

export interface CollapseAccount {
  id: string;
  /** 'transfer'/'cash' se colapsan al compartido; otros tipos (tarjetas) solo cambian de dueño. */
  type: string;
  ownerMemberId: string | null;
  /** '' en el medio compartido; nombre del titular en los medios por-persona. */
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
  /** TODOS los medios NO archivados del workspace (compartidos + transfer/cash por-persona + tarjetas). */
  accounts: CollapseAccount[];
  /** Movimientos de esos medios (se usan para contar y para repuntar transfer/cash). */
  transactions: CollapseTx[];
  apodos: CollapseApodo[];
}

/** Placeholder a crear (persona del grupo sin cuenta). `tempId` referencia el plan antes del insert. */
export interface PlaceholderPlan {
  tempId: string;
  name: string;
  aliases: string[];
}

/** Alias a AGREGAR a un miembro existente (venían del `holder_aliases` de un medio suyo). */
export interface MemberAliasAddition {
  memberId: string;
  aliases: string[];
}

/** Atribución + repunteo de un movimiento de transfer/cash. `ownerRef` = `memberId` o `tempId`. */
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

/** Enganche de un medio de no-miembro a la persona (setea `owner_member_id`). Para tarjetas: no archiva
 *  ni repuntea, solo cambia el dueño → sus movimientos pasan a resolver por la persona. */
export interface AccountOwnerUpdate {
  accountId: string;
  ownerRef: string; // memberId o tempId de placeholder
  holderName: string;
  targetName: string;
}

/** Detalle legible para el dry-run: a dónde va cada medio de no-miembro. */
export interface AccountResolution {
  accountId: string;
  holderName: string;
  type: string;
  targetRef: string;
  targetKind: 'member' | 'placeholder';
  targetName: string;
  movements: number;
  /** `member`/`placeholder`: se engancha a esa persona · `archive-only`: transfer/cash sin persona
   *  (0 movimientos) que solo se archiva · `skip`: tarjeta sin persona (0 movimientos). */
  action: 'member' | 'placeholder' | 'archive-only' | 'skip';
}

export interface CollapsePlan {
  placeholders: PlaceholderPlan[];
  memberAliasAdditions: MemberAliasAddition[];
  attributions: TxAttribution[];
  archiveAccountIds: string[];
  accountOwnerUpdates: AccountOwnerUpdate[];
  apodoRemaps: ApodoRemap[];
  resolutions: AccountResolution[];
  /** Advertencias no bloqueantes (medio compartido faltante, etc.). */
  warnings: string[];
}

const isSharedType = (type: string): boolean => type === 'transfer' || type === 'cash';
const isShared = (a: CollapseAccount): boolean =>
  isSharedType(a.type) && a.ownerMemberId === null && a.holderName === '';
/** Medio de no-miembro (por-persona): tiene titular por nombre y no está vinculado a un miembro. */
const isNonMember = (a: CollapseAccount): boolean =>
  a.ownerMemberId === null && a.holderName.trim() !== '' && !isShared(a);

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

interface Cluster {
  tempId: string;
  repName: string;
  /** Todos los nombres/titular vistos en el cluster: sirven de "alias" para matchear los siguientes. */
  holderNames: string[];
  aliases: string[];
  accountIds: string[];
}

export function planWorkspaceCollapse(input: CollapseInput): CollapsePlan {
  const { members, accounts, transactions, apodos } = input;

  const memberById = new Map(members.map((m) => [m.id, m]));
  const nonMember = accounts.filter(isNonMember);
  const hasShared = (type: SharedType): boolean =>
    accounts.some((a) => a.type === type && isShared(a));

  const txByAccount = new Map<string, CollapseTx[]>();
  for (const tx of transactions) {
    const list = txByAccount.get(tx.accountId);
    if (list) list.push(tx);
    else txByAccount.set(tx.accountId, [tx]);
  }
  const movCount = (id: string): number => txByAccount.get(id)?.length ?? 0;

  const warnings: string[] = [];

  // 1. Agrupar los medios de no-miembro en personas. Se procesan los nombres MÁS completos primero
  //    (más tokens, luego más largos) para que el "seed" del cluster sea el nombre más rico.
  const ordered = [...nonMember].sort(
    (a, b) =>
      nameTokens(b.holderName).length - nameTokens(a.holderName).length ||
      b.holderName.length - a.holderName.length,
  );

  const clusters: Cluster[] = [];
  const memberAliasByMember = new Map<string, string[]>();
  /** accountId → persona (memberId o tempId de cluster). */
  const refByAccount = new Map<string, string>();

  for (const acc of ordered) {
    // 1a. ¿Es un miembro real? (nombre o alias del miembro).
    const member = matchMember(acc.holderName, members);
    if (member) {
      refByAccount.set(acc.id, member.id);
      if (acc.holderAliases.length > 0) {
        memberAliasByMember.set(
          member.id,
          mergeAliases(memberAliasByMember.get(member.id) ?? [], acc.holderAliases),
        );
      }
      continue;
    }
    // 1b. ¿Cae en un cluster ya formado? (match conservador contra los nombres del cluster).
    const clusterAsMembers = clusters.map((c) => ({ id: c.tempId, name: c.repName, aliases: c.holderNames }));
    const hit = matchMember(acc.holderName, clusterAsMembers);
    if (hit) {
      const c = clusters.find((x) => x.tempId === hit.id)!;
      c.holderNames.push(acc.holderName);
      c.aliases = mergeAliases(c.aliases, acc.holderAliases);
      c.accountIds.push(acc.id);
      refByAccount.set(acc.id, c.tempId);
      continue;
    }
    // 1c. Persona nueva (cluster). tempId estable por nombre normalizado (o crudo si no da clave).
    const key = normalizeNameKey(acc.holderName) || acc.holderName.trim().toLowerCase();
    let tempId = `ph:${key}`;
    if (clusters.some((c) => c.tempId === tempId)) tempId = `ph:${key}#${clusters.length}`;
    clusters.push({
      tempId,
      repName: acc.holderName.trim(),
      holderNames: [acc.holderName],
      aliases: mergeAliases(acc.holderAliases),
      accountIds: [acc.id],
    });
    refByAccount.set(acc.id, tempId);
  }

  // 2. Personas-cluster que se crean: las que tienen ≥1 movimiento (en cualquiera de sus medios).
  const clusterMovs = (c: Cluster): number => c.accountIds.reduce((s, id) => s + movCount(id), 0);
  const created = clusters.filter((c) => clusterMovs(c) > 0);
  const createdIds = new Set(created.map((c) => c.tempId));
  const clusterById = new Map(clusters.map((c) => [c.tempId, c]));

  const personExists = (ref: string): boolean => memberById.has(ref) || createdIds.has(ref);
  const personName = (ref: string): string =>
    memberById.get(ref)?.name ?? clusterById.get(ref)?.repName ?? ref;

  // 3. Recorrer cada medio de no-miembro: enganchar/archivar/repuntar según su tipo y si hay persona.
  const attributions: TxAttribution[] = [];
  const accountOwnerUpdates: AccountOwnerUpdate[] = [];
  const archiveAccountIds: string[] = [];
  const resolutions: AccountResolution[] = [];
  const neededShared = new Set<SharedType>();

  for (const acc of accounts) {
    if (isShared(acc)) continue;
    const isTC = isSharedType(acc.type);
    // Tarjeta ya vinculada a un miembro: no se toca (la persona ya se resuelve por su dueño).
    if (!isTC && acc.ownerMemberId !== null) continue;
    // Persona del medio: su dueño si lo tiene, o la resuelta por clustering (no-miembro).
    const ref = acc.ownerMemberId ?? refByAccount.get(acc.id);
    if (!ref) continue;

    const exists = personExists(ref);
    const kind: 'member' | 'placeholder' = memberById.has(ref) ? 'member' : 'placeholder';
    const movs = movCount(acc.id);

    if (isTC) {
      archiveAccountIds.push(acc.id); // transfer/cash por-persona → siempre se archiva
      if (exists) {
        for (const tx of txByAccount.get(acc.id) ?? []) {
          neededShared.add(acc.type as SharedType);
          attributions.push({
            txId: tx.id,
            ownerRef: tx.ownerMemberId ?? ref,
            sharedType: acc.type as SharedType,
            keepExistingOwner: tx.ownerMemberId !== null,
          });
        }
      }
      resolutions.push({
        accountId: acc.id,
        holderName: acc.holderName,
        type: acc.type,
        targetRef: ref,
        targetKind: kind,
        targetName: personName(ref),
        movements: movs,
        action: exists ? kind : 'archive-only',
      });
    } else {
      // Tarjeta de no-miembro: solo cambia el dueño (si la persona se crea). No se archiva ni repuntea.
      if (exists) {
        accountOwnerUpdates.push({ accountId: acc.id, ownerRef: ref, holderName: acc.holderName, targetName: personName(ref) });
      }
      resolutions.push({
        accountId: acc.id,
        holderName: acc.holderName,
        type: acc.type,
        targetRef: ref,
        targetKind: kind,
        targetName: personName(ref),
        movements: movs,
        action: exists ? kind : 'skip',
      });
    }
  }
  for (const type of neededShared) {
    if (!hasShared(type)) {
      warnings.push(`No existe el medio "${type}" compartido: el runner debe crearlo antes de repuntar.`);
    }
  }

  // 4. Remapear apodos MEJ-8 name:<clave> → member:<id> de la persona (drop si colisiona con uno existente).
  const memberApodoKeys = new Set(
    apodos.filter((a) => a.personaKey.startsWith('member:')).map((a) => `${a.userId}|${a.personaKey}`),
  );
  const targetByNameKey = new Map<string, string>();
  for (const acc of nonMember) {
    const ref = refByAccount.get(acc.id);
    const k = normalizeNameKey(acc.holderName);
    if (ref && personExists(ref) && k) targetByNameKey.set(k, ref);
  }
  const apodoRemaps: ApodoRemap[] = [];
  for (const apodo of apodos) {
    if (!apodo.personaKey.startsWith('name:')) continue;
    const toRef = targetByNameKey.get(apodo.personaKey.slice('name:'.length));
    if (!toRef) continue; // ningún medio explica este apodo → se deja
    const collision = memberApodoKeys.has(`${apodo.userId}|member:${toRef}`);
    apodoRemaps.push({ userId: apodo.userId, fromKey: apodo.personaKey, toRef, collision });
  }

  const memberAliasAdditions: MemberAliasAddition[] = [...memberAliasByMember.entries()].map(
    ([memberId, aliases]) => ({ memberId, aliases }),
  );

  return {
    placeholders: created.map((c) => ({ tempId: c.tempId, name: c.repName, aliases: c.aliases })),
    memberAliasAdditions,
    attributions,
    archiveAccountIds,
    accountOwnerUpdates,
    apodoRemaps,
    resolutions,
    warnings,
  };
}
