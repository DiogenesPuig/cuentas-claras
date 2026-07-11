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
  { id: 'a1', type: 'transfer', ownerMemberId: null, holderName: 'Pepito Gomez', holderAliases: ['Pepe'] },
  { id: 'a2', type: 'transfer', ownerMemberId: null, holderName: 'GOMEZ PEPITO', holderAliases: ['Pepito G'] },
  { id: 'a3', type: 'transfer', ownerMemberId: 'm1', holderName: 'Juan Perez', holderAliases: ['Juanci'] },
  { id: 'a4', type: 'transfer', ownerMemberId: null, holderName: 'Juan Pérez', holderAliases: [] },
  { id: 'a5', type: 'cash', ownerMemberId: null, holderName: 'NX Leandro Tallarico', holderAliases: [] },
];

const transactions: CollapseTx[] = [
  { id: 't1', accountId: 'a1', ownerMemberId: null },
  { id: 't2', accountId: 'a3', ownerMemberId: 'm1' },
  { id: 't3', accountId: 'a4', ownerMemberId: null },
  { id: 't4', accountId: 'a5', ownerMemberId: null },
  { id: 't5', accountId: 'sT', ownerMemberId: 'm1' }, // ya en el compartido → se ignora
];

const apodos: CollapseApodo[] = [
  { userId: 'u1', personaKey: 'member:m1' }, // apodo existente → provoca colisión
  { userId: 'u1', personaKey: 'name:GOMEZ PEPITO' },
  { userId: 'u1', personaKey: 'name:JUAN PEREZ' },
  { userId: 'u1', personaKey: 'name:NADIE DESCONOCIDO' }, // sin medio → se deja
];

const input: CollapseInput = { members, accounts, transactions, apodos };

describe('planWorkspaceCollapse', () => {
  const plan = planWorkspaceCollapse(input);

  it('dedup: dos medios del mismo nombre normalizado → UN placeholder con alias unidos', () => {
    expect(plan.placeholders).toHaveLength(1);
    const ph = plan.placeholders[0];
    expect(ph.tempId).toBe('ph:GOMEZ PEPITO');
    expect(ph.name).toBe('Pepito Gomez');
    expect(ph.aliases).toEqual(['Pepe', 'Pepito G']);
  });

  it('medio vinculado a un miembro: mueve sus holder_aliases al miembro', () => {
    const add = plan.memberAliasAdditions.find((a) => a.memberId === 'm1');
    expect(add?.aliases).toEqual(['Juanci']);
    // m2 no recibió alias (su medio no tenía holder_aliases).
    expect(plan.memberAliasAdditions.some((a) => a.memberId === 'm2')).toBe(false);
  });

  it('matchMember por nombre (a4→m1) y por alias exacto (a5→m2)', () => {
    const r4 = plan.resolutions.find((r) => r.accountId === 'a4');
    expect(r4).toMatchObject({ targetKind: 'member', targetRef: 'm1' });
    const r5 = plan.resolutions.find((r) => r.accountId === 'a5');
    expect(r5).toMatchObject({ targetKind: 'member', targetRef: 'm2' });
  });

  it('atribuye los movimientos y respeta el owner ya seteado', () => {
    const byTx = new Map(plan.attributions.map((a) => [a.txId, a]));
    expect(byTx.get('t1')).toMatchObject({ ownerRef: 'ph:GOMEZ PEPITO', sharedType: 'transfer', keepExistingOwner: false });
    expect(byTx.get('t2')).toMatchObject({ ownerRef: 'm1', keepExistingOwner: true });
    expect(byTx.get('t3')).toMatchObject({ ownerRef: 'm1', keepExistingOwner: false });
    expect(byTx.get('t4')).toMatchObject({ ownerRef: 'm2', sharedType: 'cash', keepExistingOwner: false });
    expect(byTx.has('t5')).toBe(false); // el que ya estaba en el compartido no se toca
  });

  it('archiva todos los medios legacy (no el compartido)', () => {
    expect(new Set(plan.archiveAccountIds)).toEqual(new Set(['a1', 'a2', 'a3', 'a4', 'a5']));
  });

  it('avisa cuando falta el medio compartido del tipo requerido (cash)', () => {
    expect(plan.warnings.some((w) => w.includes('cash'))).toBe(true);
  });

  it('remapea apodos name:→member y marca la colisión con uno existente', () => {
    const byFrom = new Map(plan.apodoRemaps.map((r) => [r.fromKey, r]));
    expect(byFrom.get('name:GOMEZ PEPITO')).toMatchObject({ toRef: 'ph:GOMEZ PEPITO', collision: false });
    expect(byFrom.get('name:JUAN PEREZ')).toMatchObject({ toRef: 'm1', collision: true });
    expect(byFrom.has('name:NADIE DESCONOCIDO')).toBe(false); // sin medio que lo explique
  });
});
