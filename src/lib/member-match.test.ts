import { describe, expect, it } from 'vitest';
import { matchMember, type MatchableMember } from './member-match';

const MEMBERS: MatchableMember[] = [
  { id: 'm1', name: 'Juan Pérez' },
  { id: 'm2', name: 'María Gómez' },
];

describe('matchMember', () => {
  it('matchea con el nombre en orden normal', () => {
    expect(matchMember('Juan Pérez', MEMBERS)?.id).toBe('m1');
  });

  it('matchea con el nombre en orden invertido (apellido nombre)', () => {
    expect(matchMember('Pérez Juan', MEMBERS)?.id).toBe('m1');
  });

  it('exige al menos 2 tokens significativos: con uno solo no matchea', () => {
    expect(matchMember('Juan', MEMBERS)).toBeNull();
  });

  it('sin miembros, devuelve null', () => {
    expect(matchMember('Juan Pérez', [])).toBeNull();
  });

  it('sin holder, devuelve null', () => {
    expect(matchMember(null, MEMBERS)).toBeNull();
  });

  it('ante ambigüedad (varios miembros con el mismo overlap) no preasigna', () => {
    const members: MatchableMember[] = [
      { id: 'a', name: 'Juan Pérez' },
      { id: 'b', name: 'Carlos Pérez' },
    ];
    expect(matchMember('Juan Carlos Pérez', members)).toBeNull();
  });

  it('no matchea si comparte un solo token (ej. apellido común)', () => {
    const members: MatchableMember[] = [{ id: 'a', name: 'Ana Pérez' }];
    expect(matchMember('Juan Pérez', members)).toBeNull();
  });

  it('matchea por alias exacto de una sola palabra (ej. "Pepito" → José Pérez)', () => {
    const members: MatchableMember[] = [
      { id: 'a', name: 'José Pérez', aliases: ['Pepito'] },
      { id: 'b', name: 'María Gómez' },
    ];
    expect(matchMember('Pepito', members)?.id).toBe('a');
    // Sin alias, "Pepito" (1 token) no matchearía a nadie.
    expect(matchMember('Pepito', [{ id: 'a', name: 'José Pérez' }])).toBeNull();
  });

  it('matchea por alias con ≥2 tokens (variante de nombre completo)', () => {
    const members: MatchableMember[] = [{ id: 'a', name: 'José Pérez', aliases: ['Pepe Perez'] }];
    expect(matchMember('Pepe Pérez', members)?.id).toBe('a');
  });

  it('alias insensible a tildes/orden en el match exacto', () => {
    const members: MatchableMember[] = [{ id: 'a', name: 'Ana Díaz', aliases: ['Añá'] }];
    expect(matchMember('aña', members)?.id).toBe('a');
  });

  it('ante alias ambiguo (dos miembros con el mismo alias) no preasigna', () => {
    const members: MatchableMember[] = [
      { id: 'a', name: 'José Pérez', aliases: ['Flaco'] },
      { id: 'b', name: 'Juan López', aliases: ['Flaco'] },
    ];
    expect(matchMember('Flaco', members)).toBeNull();
  });
});
