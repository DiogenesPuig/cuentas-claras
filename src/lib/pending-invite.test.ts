import { afterEach, describe, expect, it } from 'vitest';
import { clearPendingInvite, getPendingInvite, savePendingInvite } from './pending-invite';

afterEach(() => clearPendingInvite());

describe('pending-invite (BUG-16)', () => {
  it('sin nada guardado, getPendingInvite devuelve null', () => {
    expect(getPendingInvite()).toBeNull();
  });

  it('guarda y recupera el destino de la invitación', () => {
    savePendingInvite('/invite/abc123');
    expect(getPendingInvite()).toBe('/invite/abc123');
  });

  it('clear lo borra', () => {
    savePendingInvite('/invite/abc123');
    clearPendingInvite();
    expect(getPendingInvite()).toBeNull();
  });
});
