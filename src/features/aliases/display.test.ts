import { describe, expect, it } from 'vitest';
import { displayPersonaLabel, type AliasMap } from './display';

describe('displayPersonaLabel', () => {
  const aliases: AliasMap = {
    'member:m1': 'Dioge',
    'name:juan perez': 'Juancho',
    'name:vacio': '   ',
  };

  it('devuelve el apodo cuando existe para la clave', () => {
    expect(displayPersonaLabel('member:m1', 'Diógenes', aliases)).toBe('Dioge');
    expect(displayPersonaLabel('name:juan perez', 'Juan Perez', aliases)).toBe('Juancho');
  });

  it('cae al label base cuando no hay apodo para la clave', () => {
    expect(displayPersonaLabel('member:m2', 'Ana', aliases)).toBe('Ana');
    expect(displayPersonaLabel('otros', 'Otros', aliases)).toBe('Otros');
  });

  it('ignora un apodo en blanco (cae al label base)', () => {
    expect(displayPersonaLabel('name:vacio', 'Pedro', aliases)).toBe('Pedro');
  });
});
