import pkit from '../src/index';
import { GENERAL_ROLE } from '../src/constants';
import { getOrCreateState } from '../src/state';

export const STAFF_REPORTS = 'staff::inventory.reports::all';
export const ADMIN_REPORTS = 'admin::inventory.reports::all';
export const STAFF_ITEMS_ALL = 'staff::inventory.items::all';
export const ADMIN_ITEMS_ALL = 'admin::inventory.items::all';
export const STAFF_ITEMS_UPDATE_ONLY = 'staff::inventory.items::update-only';

const ITEM_SUMMARY = { find: { enabled: true, properties: ['id', 'name', 'assetId'] } } as const;

export function resetState(): void {
  const state = getOrCreateState();

  state.roles = new Set([GENERAL_ROLE]);
  state.modules.clear();
  state.snapshot = null;
}

export function setupInventory() {
  resetState();
  pkit.context.set('roles', ['admin', 'staff', 'public']);

  const items = pkit.module('inventory').module('items');
  const itemsAll = items.name('all');
  const itemsUpdateOnly = items.name('update-only');
  const reports = pkit.module('inventory').module('reports').name('all');

  itemsAll.role('staff').registerActions({
    find: { enabled: true, properties: ['id', 'name', 'assetId'] },
    update: { enabled: true, properties: ['id', 'name', 'description'] },
    create: { enabled: false, properties: [] },
  });

  itemsAll.role('admin').registerActions({
    find: { enabled: true, properties: '*' },
    update: { enabled: true, properties: '*' },
    create: { enabled: true, properties: ['name', 'link'] },
    remove: { enabled: true, properties: ['id'] },
  });

  itemsAll.role('public').registerActions({
    find: { enabled: false, properties: [] },
  });

  itemsUpdateOnly.role('staff').registerActions({
    find: { enabled: true, properties: ['id', 'name', 'assetId'] },
    update: { enabled: true, properties: ['id', 'name', 'assetId'] },
  });

  itemsAll.grantTo(ADMIN_REPORTS).registerActions(ITEM_SUMMARY);
  itemsAll.grantTo(STAFF_REPORTS).registerActions(ITEM_SUMMARY);
  itemsUpdateOnly.grantTo(ADMIN_REPORTS).registerActions(ITEM_SUMMARY);
  itemsUpdateOnly.grantTo(STAFF_REPORTS).registerActions(ITEM_SUMMARY);

  reports.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
  reports.role('admin').registerActions({ find: { enabled: true, properties: '*' } });

  return { items, itemsAll, itemsUpdateOnly, reports };
}

export function allowHook(): void {}
