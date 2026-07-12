/**
 * IDENT-1 paso 5 — RUNNER (cascarón) del backfill + colapso de medios transfer/cash por-persona.
 *
 * NO es un test: es una migración de datos de un solo uso. Se ejecuta vía vitest solo porque es la
 * única toolchain del repo que resuelve los imports de `@/lib` (Node no resuelve los imports sin
 * extensión). Por eso va guardada tras `IDENT1` y en CI (sin esa env) registra 0 tests.
 *
 * Uso:
 *   Dry-run (solo lee, imprime el plan):
 *     IDENT1=1 SB_URL=... SB_KEY=<service_role> IDENT1_OUT=/ruta/plan.txt \
 *       npx vitest run scripts/ident1-collapse.harness.test.ts
 *   Aplicar (escribe):  añadir IDENT1_APPLY=1
 *
 * Seguridad: por defecto NO escribe. Nunca borra medios (los archiva). Idempotente: al re-correr, los
 * medios ya archivados quedan fuera del set legacy y no se re-procesan.
 */
import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { planWorkspaceCollapse, type CollapseInput } from '@/lib/ident1-collapse';

/** Mapeos confirmados con el usuario (2026-07-11): holder que en realidad es un miembro existente.
 *  Se suman como ALIAS al miembro ANTES de planificar, para que resuelva al miembro y no a un
 *  placeholder duplicado. Auditable acá; se reusa igual en local y en remoto (los nombres coinciden). */
const MANUAL_MEMBER_ALIASES: { memberName: string; alias: string }[] = [
  { memberName: 'Diogenes', alias: 'Diogenes Alejandro Xavier Puig' },
];

const SHARED_NAME: Record<'transfer' | 'cash', string> = {
  transfer: 'Transferencia',
  cash: 'Efectivo',
};

describe.runIf(process.env.IDENT1)('IDENT-1 collapse runner', () => {
  it('planifica (y opcionalmente aplica) el colapso por workspace', async () => {
    const apply = process.env.IDENT1_APPLY === '1';
    const sb = createClient(process.env.SB_URL!, process.env.SB_KEY!, {
      auth: { persistSession: false },
    });
    const out: string[] = [];
    const log = (...p: string[]) => out.push(p.join(' '));
    log(`# IDENT-1 collapse — modo ${apply ? 'APPLY (escribe)' : 'DRY-RUN (solo lee)'}`);

    // ---- lectura global ----
    const [wmRes, profRes] = await Promise.all([
      sb.from('workspace_members').select('id, workspace_id, user_id, name, aliases'),
      sb.from('profiles').select('id, name'),
    ]);
    if (wmRes.error) throw wmRes.error;
    if (profRes.error) throw profRes.error;
    const profName = new Map((profRes.data ?? []).map((p) => [p.id, p.name as string]));
    const liveName = (m: { user_id: string | null; name: string | null }) =>
      (m.user_id ? profName.get(m.user_id) : m.name) ?? 'Sin nombre';

    const wsIds = [...new Set((wmRes.data ?? []).map((m) => m.workspace_id))];

    for (const wsId of wsIds) {
      // A. Curar alias de miembros confirmados (union) ANTES de planificar.
      const wsMembers = (wmRes.data ?? []).filter((m) => m.workspace_id === wsId);
      for (const { memberName, alias } of MANUAL_MEMBER_ALIASES) {
        const target = wsMembers.find((m) => liveName(m) === memberName);
        if (!target) continue;
        const current = (target.aliases as string[]) ?? [];
        if (current.some((a) => a.toLowerCase() === alias.toLowerCase())) continue;
        const next = [...current, alias];
        log(`[${wsId}] alias → miembro ${memberName}: +"${alias}"`);
        if (apply) {
          const { error } = await sb.from('workspace_members').update({ aliases: next }).eq('id', target.id);
          if (error) throw error;
        }
        target.aliases = next; // reflejar en memoria para el planner
      }

      // B. Leer el estado del workspace (medios legacy NO archivados + sus movimientos + apodos).
      const [accRes, apoRes] = await Promise.all([
        // Todos los medios activos (incluye tarjetas: se enganchan a la persona si matchean).
        sb
          .from('accounts')
          .select('id, type, owner_member_id, holder_name, holder_aliases')
          .eq('workspace_id', wsId)
          .eq('is_archived', false),
        sb.from('persona_aliases').select('user_id, persona_key').eq('workspace_id', wsId),
      ]);
      if (accRes.error) throw accRes.error;
      if (apoRes.error) throw apoRes.error;
      // Solo se cargan los movimientos de los medios transfer/cash (son los que se reatribuyen).
      const collapseIds = (accRes.data ?? [])
        .filter((a) => a.type === 'transfer' || a.type === 'cash')
        .map((a) => a.id);
      const txRes = collapseIds.length
        ? await sb.from('transactions').select('id, account_id, owner_member_id').in('account_id', collapseIds)
        : { data: [], error: null };
      if (txRes.error) throw txRes.error;

      const input: CollapseInput = {
        members: wsMembers.map((m) => ({ id: m.id, name: liveName(m), aliases: (m.aliases as string[]) ?? [] })),
        accounts: (accRes.data ?? []).map((a) => ({
          id: a.id,
          type: a.type as string,
          ownerMemberId: a.owner_member_id,
          holderName: a.holder_name,
          holderAliases: (a.holder_aliases as string[]) ?? [],
        })),
        transactions: (txRes.data ?? []).map((t) => ({ id: t.id, accountId: t.account_id!, ownerMemberId: t.owner_member_id })),
        apodos: (apoRes.data ?? []).map((a) => ({ userId: a.user_id, personaKey: a.persona_key })),
      };
      const plan = planWorkspaceCollapse(input);

      log(`\n===== workspace ${wsId} =====`);
      for (const r of plan.resolutions) {
        log(`  "${r.holderName}" (${r.type}, ${r.movements} mov) → ${r.action.toUpperCase()} ${r.targetName}`);
      }
      for (const u of plan.accountOwnerUpdates) {
        log(`  [tarjeta] "${u.holderName}" → ${u.targetName}`);
      }
      if (plan.warnings.length) log('AVISOS:', plan.warnings.join(' | '));
      if (!apply) {
        log(
          `RESUMEN: placeholders=${plan.placeholders.length} · reatribuir=${plan.attributions.length} · archivar=${plan.archiveAccountIds.length} · tarjetas-enganchadas=${plan.accountOwnerUpdates.length} · apodos=${plan.apodoRemaps.length}`,
        );
        continue;
      }

      // ---- APPLY ----
      await applyPlan(sb, wsId, plan, log);
    }

    if (process.env.IDENT1_OUT) writeFileSync(process.env.IDENT1_OUT, out.join('\n'));
  }, 60_000);
});

type Plan = ReturnType<typeof planWorkspaceCollapse>;

async function applyPlan(
  sb: SupabaseClient,
  wsId: string,
  plan: Plan,
  log: (...p: string[]) => void,
): Promise<void> {
  // 1. Sumar alias movidos a miembros (union).
  for (const add of plan.memberAliasAdditions) {
    const cur = await sb.from('workspace_members').select('aliases').eq('id', add.memberId).single();
    if (cur.error) throw cur.error;
    const merged = [...new Set([...(cur.data.aliases as string[]), ...add.aliases])];
    const { error } = await sb.from('workspace_members').update({ aliases: merged }).eq('id', add.memberId);
    if (error) throw error;
  }

  // 2. Crear placeholders (idempotente: reusar por nombre si ya existe uno sin cuenta).
  const realByTempId = new Map<string, string>();
  for (const ph of plan.placeholders) {
    const existing = await sb
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', wsId)
      .is('user_id', null)
      .eq('name', ph.name)
      .limit(1);
    if (existing.error) throw existing.error;
    if (existing.data[0]) {
      realByTempId.set(ph.tempId, existing.data[0].id);
      continue;
    }
    const ins = await sb
      .from('workspace_members')
      .insert({ workspace_id: wsId, user_id: null, name: ph.name, role: 'member', aliases: ph.aliases })
      .select('id')
      .single();
    if (ins.error) throw ins.error;
    realByTempId.set(ph.tempId, ins.data.id);
    log(`[${wsId}] placeholder creado: ${ph.name} (${ins.data.id})`);
  }
  const resolveRef = (ref: string) => (ref.startsWith('ph:') ? realByTempId.get(ref)! : ref);

  // 3. Get-or-create de los medios compartidos que hagan falta.
  const sharedId = new Map<'transfer' | 'cash', string>();
  const neededTypes = new Set(plan.attributions.map((a) => a.sharedType));
  for (const type of neededTypes) {
    const found = await sb
      .from('accounts')
      .select('id')
      .eq('workspace_id', wsId)
      .eq('type', type)
      .is('owner_member_id', null)
      .eq('holder_name', '')
      .limit(1);
    if (found.error) throw found.error;
    if (found.data[0]) {
      sharedId.set(type, found.data[0].id);
    } else {
      const ins = await sb
        .from('accounts')
        .insert({ workspace_id: wsId, name: SHARED_NAME[type], type, owner_member_id: null, holder_name: '' })
        .select('id')
        .single();
      if (ins.error) throw ins.error;
      sharedId.set(type, ins.data.id);
      log(`[${wsId}] medio compartido creado: ${SHARED_NAME[type]}`);
    }
  }

  // 4. Reatribuir + repuntar movimientos.
  for (const at of plan.attributions) {
    const { error } = await sb
      .from('transactions')
      .update({ owner_member_id: resolveRef(at.ownerRef), account_id: sharedId.get(at.sharedType)! })
      .eq('id', at.txId);
    if (error) throw error;
  }
  log(`[${wsId}] movimientos reatribuidos: ${plan.attributions.length}`);

  // 5. Archivar los medios legacy.
  if (plan.archiveAccountIds.length) {
    const { error } = await sb.from('accounts').update({ is_archived: true }).in('id', plan.archiveAccountIds);
    if (error) throw error;
  }
  log(`[${wsId}] medios archivados: ${plan.archiveAccountIds.length}`);

  // 5b. Enganchar tarjetas de no-miembro a la persona (setea owner_member_id; no archiva ni repuntea).
  for (const u of plan.accountOwnerUpdates) {
    const { error } = await sb
      .from('accounts')
      .update({ owner_member_id: resolveRef(u.ownerRef) })
      .eq('id', u.accountId);
    if (error) throw error;
  }
  if (plan.accountOwnerUpdates.length) log(`[${wsId}] tarjetas enganchadas: ${plan.accountOwnerUpdates.length}`);

  // 6. Remapear apodos MEJ-8 name:→member: (drop si el target ya tiene apodo).
  for (const rm of plan.apodoRemaps) {
    const toKey = `member:${resolveRef(rm.toRef)}`;
    if (rm.collision) {
      await sb.from('persona_aliases').delete().eq('user_id', rm.userId).eq('workspace_id', wsId).eq('persona_key', rm.fromKey);
    } else {
      const { error } = await sb
        .from('persona_aliases')
        .update({ persona_key: toKey })
        .eq('user_id', rm.userId)
        .eq('workspace_id', wsId)
        .eq('persona_key', rm.fromKey);
      if (error) throw error;
    }
  }
  if (plan.apodoRemaps.length) log(`[${wsId}] apodos remapeados: ${plan.apodoRemaps.length}`);
}
