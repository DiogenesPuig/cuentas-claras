import { describe, expect, it } from 'vitest';
import {
  planWorkspaceCollapse,
  type CollapseAccount,
  type CollapseApodo,
  type CollapseInput,
  type CollapseMember,
  type CollapseTx,
} from './ident1-collapse';

const members: CollapseMember[] = [
  { id: 'm1', name: 'Juan Pérez', aliases: [] },
  { id: 'm2', name: 'Ana', aliases: ['NX Leandro Tallarico'] }, // nombre corto + alias para el match
];

const accounts: CollapseAccount[] = [
  { id: 'sT', type: 'transfer', ownerMemberId: null, holderName: '', holderAliases: [] }, // compartido
  // Miguel: transferencia (con "DOMINGO" + coma) + tarjetas escritas distinto → UNA persona por match.
  { id: 'mig_t', type: 'transfer', ownerMemberId: null, holderName: 'PUIG LUCAS, MIGUEL DOMINGO', holderAliases: [] },
  { id: 'mig_c1', type: 'credit', ownerMemberId: null, holderName: 'LUCAS MIGUEL PUIG', holderAliases: [] },
  { id: 'mig_c2', type: 'credit', ownerMemberId: null, holderName: 'D MIGUEL LUCAS PUIG', holderAliases: [] },
  // Agata: SOLO tarjeta con movimientos (sin transferencia) → igual se crea persona.
  { id: 'agata', type: 'credit', ownerMemberId: null, holderName: 'AGATA HELENA PUIG', holderAliases: [] },
  // Miembro por match de nombre y por alias:
  { id: 'juan_c', type: 'credit', ownerMemberId: null, holderName: 'Juan Perez', holderAliases: ['Juanci'] },
  { id: 'leo_t', type: 'cash', ownerMemberId: null, holderName: 'NX Leandro Tallarico', holderAliases: [] },
  // No-miembro SIN movimientos: transferencia se archiva sin crear persona; tarjeta se saltea.
  { id: 'nadie_t', type: 'transfer', ownerMemberId: null, holderName: 'Solo Archivar Nadie', holderAliases: ['Zutano'] },
  { id: 'nadie_c', type: 'credit', ownerMemberId: null, holderName: 'Otro Fantasma', holderAliases: [] },
];

const transactions: CollapseTx[] = [
  { id: 't1', accountId: 'mig_t', ownerMemberId: null }, // transfer Miguel
  { id: 't2', accountId: 'mig_c1', ownerMemberId: null }, // tarjeta Miguel
  { id: 't3', accountId: 'mig_c2', ownerMemberId: null }, // tarjeta Miguel (otra grafía)
  { id: 't4', accountId: 'agata', ownerMemberId: null }, // tarjeta Agata
  { id: 't5', accountId: 'juan_c', ownerMemberId: null }, // tarjeta que es del miembro m1
  { id: 't6', accountId: 'leo_t', ownerMemberId: null }, // cash que matchea a m2 por alias
  { id: 't7', accountId: 'sT', ownerMemberId: 'm1' }, // ya en el compartido → se ignora
];

const apodos: CollapseApodo[] = [
  { userId: 'u1', personaKey: 'member:m1' }, // apodo existente → colisión
  { userId: 'u1', personaKey: 'name:LUCAS MIGUEL PUIG' }, // → persona Miguel
  { userId: 'u1', personaKey: 'name:JUAN PEREZ' }, // → miembro m1 (colisión)
];

const input: CollapseInput = { members, accounts, transactions, apodos };
const plan = planWorkspaceCollapse(input);
const refOf = (accountId: string) => plan.resolutions.find((r) => r.accountId === accountId)?.targetRef;

describe('planWorkspaceCollapse', () => {
  it('unifica todos los medios de Miguel (transfer + 2 tarjetas, grafías distintas) en UNA persona', () => {
    const miguelRef = refOf('mig_t');
    expect(miguelRef).toBeDefined();
    expect(refOf('mig_c1')).toBe(miguelRef);
    expect(refOf('mig_c2')).toBe(miguelRef);
    // Es un placeholder (no miembro) y se crea una sola vez.
    expect(plan.placeholders.filter((p) => p.tempId === miguelRef)).toHaveLength(1);
  });

  it('crea persona para un no-miembro que SOLO tiene tarjeta con movimientos (Agata)', () => {
    const agataRef = refOf('agata')!;
    expect(plan.placeholders.some((p) => p.tempId === agataRef)).toBe(true);
    // La tarjeta se engancha (cambia de dueño), no se archiva.
    expect(plan.accountOwnerUpdates.some((u) => u.accountId === 'agata')).toBe(true);
    expect(plan.archiveAccountIds).not.toContain('agata');
  });

  it('engancha a un miembro real por nombre (tarjeta) y por alias (cash), y mueve sus holder_aliases', () => {
    expect(refOf('juan_c')).toBe('m1');
    expect(refOf('leo_t')).toBe('m2');
    expect(plan.memberAliasAdditions.find((a) => a.memberId === 'm1')?.aliases).toEqual(['Juanci']);
  });

  it('archiva las transferencias/efectivo por-persona, nunca las tarjetas', () => {
    expect(plan.archiveAccountIds).toEqual(expect.arrayContaining(['mig_t', 'leo_t', 'nadie_t']));
    expect(plan.archiveAccountIds).not.toContain('mig_c1');
    expect(plan.archiveAccountIds).not.toContain('agata');
  });

  it('no crea persona para no-miembros SIN movimientos (transfer se archiva, tarjeta se saltea)', () => {
    expect(plan.placeholders.some((p) => p.name === 'Solo Archivar Nadie')).toBe(false);
    expect(plan.placeholders.some((p) => p.name === 'Otro Fantasma')).toBe(false);
    expect(plan.resolutions.find((r) => r.accountId === 'nadie_t')?.action).toBe('archive-only');
    expect(plan.resolutions.find((r) => r.accountId === 'nadie_c')?.action).toBe('skip');
    expect(plan.accountOwnerUpdates.some((u) => u.accountId === 'nadie_c')).toBe(false);
  });

  it('reatribuye los movimientos de transfer/cash al medio compartido (no los de tarjeta)', () => {
    const txIds = new Set(plan.attributions.map((a) => a.txId));
    expect(txIds).toEqual(new Set(['t1', 't6'])); // transfer Miguel + cash Leandro; las tarjetas no
  });

  it('remapea apodos name:→persona y marca colisión con uno existente', () => {
    const byFrom = new Map(plan.apodoRemaps.map((r) => [r.fromKey, r]));
    expect(byFrom.get('name:LUCAS MIGUEL PUIG')?.toRef).toBe(refOf('mig_c1'));
    expect(byFrom.get('name:JUAN PEREZ')).toMatchObject({ toRef: 'm1', collision: true });
  });

  it('no fusiona homónimos parciales (Agata/Miguel comparten solo "PUIG")', () => {
    expect(refOf('agata')).not.toBe(refOf('mig_t'));
  });
});
