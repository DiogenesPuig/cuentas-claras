import { create } from 'zustand';

/** Clave de localStorage donde se persiste el workspace activo. */
export const ACTIVE_WORKSPACE_KEY = 'cc.activeWorkspaceId';

function readStored(): string | undefined {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY) ?? undefined;
  } catch {
    // localStorage puede no estar disponible (SSR, modo privado). No es crítico.
    return undefined;
  }
}

function writeStored(id: string | undefined): void {
  try {
    if (id === undefined) localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    else localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  } catch {
    // Persistir es best-effort; el estado en memoria sigue siendo la fuente.
  }
}

interface ActiveWorkspaceState {
  /** Id del workspace activo, o `undefined` si todavía no se eligió ninguno. */
  workspaceId: string | undefined;
  /** Selecciona el workspace activo y lo persiste en localStorage. */
  setWorkspace: (id: string) => void;
  /** Limpia el workspace activo (p. ej. al cerrar sesión). */
  clearWorkspace: () => void;
}

/**
 * Estado global del workspace activo. Hidratado desde localStorage al iniciar
 * y persistido en cada cambio. Es la fuente de verdad que leen los hooks de
 * datos (sus query keys incluyen `workspaceId`, así que cambiarlo refresca todo
 * lo que dependa del grupo).
 */
export const useActiveWorkspace = create<ActiveWorkspaceState>((set) => ({
  workspaceId: readStored(),
  setWorkspace: (id) => {
    writeStored(id);
    set({ workspaceId: id });
  },
  clearWorkspace: () => {
    writeStored(undefined);
    set({ workspaceId: undefined });
  },
}));
