import type { Method, NamedPermissionCatalog, PermissionEntry } from './types';
import { getOrCreateState } from './state';
import { permissionIdOf } from './resolve';
import { validateSealedRegistry } from './Validators';

export function seal(): void {
  const state = getOrCreateState();
  if (state.snapshot) return;

  validateSealedRegistry(state.modules);

  const named: Record<string, Readonly<Partial<Record<Method, PermissionEntry>>>> = Object.create(null);
  for (const [action, registeredModule] of state.modules) {
    for (const [name, nameEntry] of registeredModule.names) {
      for (const [role, actions] of nameEntry.actions) {
        named[permissionIdOf(role, action, name)] = actions;
      }
    }
  }

  state.snapshot = { named: Object.freeze(named) as NamedPermissionCatalog, assignable: new Set(Object.keys(named)) };
}
