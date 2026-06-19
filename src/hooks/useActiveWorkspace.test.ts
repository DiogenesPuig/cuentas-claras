import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIVE_WORKSPACE_KEY, useActiveWorkspace } from './useActiveWorkspace';

describe('useActiveWorkspace', () => {
  beforeEach(() => {
    localStorage.clear();
    useActiveWorkspace.setState({ workspaceId: undefined });
  });

  it('arranca sin workspace cuando localStorage está vacío', () => {
    expect(useActiveWorkspace.getState().workspaceId).toBeUndefined();
  });

  it('setWorkspace actualiza el estado y persiste en localStorage', () => {
    useActiveWorkspace.getState().setWorkspace('ws-1');

    expect(useActiveWorkspace.getState().workspaceId).toBe('ws-1');
    expect(localStorage.getItem(ACTIVE_WORKSPACE_KEY)).toBe('ws-1');
  });

  it('clearWorkspace limpia el estado y el localStorage', () => {
    useActiveWorkspace.getState().setWorkspace('ws-1');
    useActiveWorkspace.getState().clearWorkspace();

    expect(useActiveWorkspace.getState().workspaceId).toBeUndefined();
    expect(localStorage.getItem(ACTIVE_WORKSPACE_KEY)).toBeNull();
  });
});
