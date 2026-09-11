import pkit from '../src/index';
import { GENERAL_ROLE } from '../src/constants';
import { getOrCreateState } from '../src/state';

export function resetState(): void {
  const state = getOrCreateState();
  state.roles = new Set([GENERAL_ROLE]);
  state.modules.clear();
  state.snapshot = null;
}

export function setupPortals() {
  resetState();
  pkit.context.set('roles', ['admin', 'staff', 'public']);
  const portals = pkit.module('marketing').module('portals');
  portals.registerActions({
    find: { properties: ['id', 'name', 'link'], enabled: true },
    update: { properties: [], enabled: false },
    create: { properties: [], enabled: false },
  });
  portals.role('staff').registerActions({
    update: { properties: ['id', 'name', 'description'], enabled: true },
  });
  portals.role('admin').registerActions({
    find: { properties: '*', enabled: true },
    update: { properties: '*', enabled: true },
    create: { properties: ['name', 'link'], enabled: true },
    remove: { properties: ['id'], enabled: true },
  });
  return portals;
}

export function allowHook(): void {}
