/**
 * Invitación pendiente (BUG-16). Cuando un usuario **sin sesión** abre un link `/invite/:token`,
 * hay que retomar esa invitación después de que se registre/loguee. El `state.from` de React Router
 * alcanza para el alta por email/password, pero el **OAuth de Google** hace un redirect de página
 * completa a la raíz y **pierde** ese estado. Por eso guardamos el destino en `sessionStorage`, que
 * sobrevive el round-trip del OAuth (misma pestaña/origen) y se limpia al cerrar la pestaña.
 *
 * Flujo: `RequireAuth` lo guarda al mandar a login; `RequireWorkspace` lo lee para no mandar a
 * onboarding a alguien que venía de una invitación; `InviteAcceptPage` lo limpia al montar.
 */
const KEY = 'pendingInvite';

export function savePendingInvite(pathname: string): void {
  try {
    sessionStorage.setItem(KEY, pathname);
  } catch {
    // sessionStorage puede no estar disponible (modo privado, etc.): degradar sin romper.
  }
}

export function getPendingInvite(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // no-op
  }
}
