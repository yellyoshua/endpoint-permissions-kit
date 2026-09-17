import { beforeEach, describe, expect, test } from 'bun:test';
import type { Context, Data } from '../src/types';
import Pkit from '../src/index';

type ExamplePkit = Pkit<'admin' | 'staff' | 'public'>;

const ADMIN_DASHBOARD = 'admin::marketing.dashboard::all';
const STAFF_DASHBOARD = 'staff::marketing.dashboard::all';
const ADMIN_PORTALS_ALL = 'admin::marketing.portals::all';
const STAFF_PORTALS_ALL = 'staff::marketing.portals::all';
const STAFF_PORTALS_UPDATE_ONLY = 'staff::marketing.portals::update-only';
const PORTAL = { id: 1, name: 'Landing', assetId: 'a-7' };

function pkitConfig(): ExamplePkit {
  const pkit = new Pkit({ roles: ['admin', 'staff', 'public'] });

  pkit.context.set('cropper', false);

  return pkit;
}

function portalsPermissions(pkit: ExamplePkit, log: string[]): void {
  const portals = pkit.module('marketing').module('portals');
  const portalsAll = portals.name('all');
  const portalsUpdateOnly = portals.name('update-only');

  portalsAll.role('staff').registerActions({
    find: { enabled: true, properties: ['id', 'name', 'assetId'] },
  });

  portalsAll.role('admin').registerActions({
    find: { enabled: true, properties: '*' },
    remove: { enabled: true, properties: ['id'] },
  });

  portalsUpdateOnly.role('staff').registerActions({
    find: { enabled: true, properties: ['id', 'name', 'assetId'] },
    update: { enabled: true, properties: ['id', 'name', 'assetId'] },
  });

  portalsAll.grantTo(ADMIN_DASHBOARD).registerActions({
    find: { enabled: true, properties: ['id', 'name', 'assetId'] },
  });

  portalsAll.grantTo(STAFF_DASHBOARD).registerActions({
    find: { enabled: true, properties: ['id', 'name', 'assetId'] },
  });

  function checkPublishedPortal(data: Data): void {
    if (data.status === 'published') {
      throw new Error('Published portals cannot be removed');
    }
  }

  portals.hook('remove', checkPublishedPortal);

  function checkPortalOwner(data: Data, context: Context): void {
    if (context.owner !== (context.user as { id: number }).id) {
      throw new Error('Only the owner can update this portal');
    }
  }

  portalsUpdateOnly.role('staff').hook('update', checkPortalOwner);

  function logStaffFind(): void {
    log.push('portalsAll.staff.find');
  }

  portalsAll.role('staff').hook('find', logStaffFind);
}

function dashboardPermissions(pkit: ExamplePkit): void {
  const dashboard = pkit.module('marketing').module('dashboard').name('all');

  dashboard.role('staff').registerActions({
    find: { enabled: true, properties: '*' },
  });

  dashboard.role('admin').registerActions({
    find: { enabled: true, properties: '*' },
  });
}

describe('USAGE.md example', () => {
  let pkit: ExamplePkit;
  let log: string[];

  beforeEach(() => {
    pkit = pkitConfig();
    log = [];
    portalsPermissions(pkit, log);
    dashboardPermissions(pkit);
  });

  test('validating a request from the docs', async () => {
    const validation = await pkit.validate({
      action: 'marketing.portals',
      method: 'find',
      role: 'staff',
      permissions: [STAFF_DASHBOARD],
      data: PORTAL,
      context: { user: { id: 7 } },
    });

    expect(validation.errors).toEqual([]);
    expect(validation.result?.data).toBe(PORTAL);

    const denied = await pkit.validate({
      action: 'marketing.portals',
      method: 'find',
      role: 'staff',
      permissions: [STAFF_DASHBOARD],
      data: { ...PORTAL, internalNotes: 'x' },
    });

    expect(denied.result).toBeNull();
    expect(denied.errors).toHaveLength(1);
    expect(denied.errors[0]).toMatchObject({ code: 'PROPERTIES_NOT_ALLOWED', fields: ['internalNotes'] });
  });

  test('admin with dashboard only: portals find gets the three fields of the grant', async () => {
    const ok = await pkit.validate({ action: 'marketing.portals', method: 'find', role: 'admin', permissions: [ADMIN_DASHBOARD], data: PORTAL });
    const denied = await pkit.validate({ action: 'marketing.portals', method: 'find', role: 'admin', permissions: [ADMIN_DASHBOARD], data: { ...PORTAL, status: 'x' } });

    expect(ok.errors).toEqual([]);
    expect(denied.errors[0]?.code).toBe('PROPERTIES_NOT_ALLOWED');
  });

  test('admin with dashboard and portals all: the direct wildcard rules', async () => {
    const ok = await pkit.validate({ action: 'marketing.portals', method: 'find', role: 'admin', permissions: [ADMIN_DASHBOARD, ADMIN_PORTALS_ALL], data: { ...PORTAL, status: 'x' } });

    expect(ok.errors).toEqual([]);
  });

  test('staff with dashboard only: the grant fields and the portalsAll staff hooks run', async () => {
    const ok = await pkit.validate({ action: 'marketing.portals', method: 'find', role: 'staff', permissions: [STAFF_DASHBOARD], data: PORTAL });

    expect(ok.errors).toEqual([]);
    expect(log).toEqual(['portalsAll.staff.find']);
  });

  test('staff with dashboard and portals all: fields of portalsAll staff', async () => {
    const ok = await pkit.validate({ action: 'marketing.portals', method: 'find', role: 'staff', permissions: [STAFF_DASHBOARD, STAFF_PORTALS_ALL], data: PORTAL });
    const denied = await pkit.validate({ action: 'marketing.portals', method: 'find', role: 'staff', permissions: [STAFF_DASHBOARD, STAFF_PORTALS_ALL], data: { status: 'x' } });

    expect(ok.errors).toEqual([]);
    expect(denied.errors[0]).toMatchObject({ code: 'PROPERTIES_NOT_ALLOWED', fields: ['status'] });
  });

  test('staff with dashboard only: portals update is METHOD_DISABLED', async () => {
    const denied = await pkit.validate({ action: 'marketing.portals', method: 'update', role: 'staff', permissions: [STAFF_DASHBOARD], data: PORTAL });

    expect(denied.result).toBeNull();
    expect(denied.errors[0]?.code).toBe('METHOD_DISABLED');
  });

  test('staff with portals update-only: update allowed with its three fields and the owner hook', async () => {
    const context = { user: { id: 7 }, owner: 7 };
    const ok = await pkit.validate({ action: 'marketing.portals', method: 'update', role: 'staff', permissions: [STAFF_PORTALS_UPDATE_ONLY], data: PORTAL, context });
    const denied = await pkit.validate({ action: 'marketing.portals', method: 'update', role: 'staff', permissions: [STAFF_PORTALS_UPDATE_ONLY], data: { description: 'x' }, context });
    const notOwner = await pkit.validate({ action: 'marketing.portals', method: 'update', role: 'staff', permissions: [STAFF_PORTALS_UPDATE_ONLY], data: PORTAL, context: { user: { id: 7 }, owner: 9 } });

    expect(ok.errors).toEqual([]);
    expect(denied.errors[0]).toMatchObject({ code: 'PROPERTIES_NOT_ALLOWED', fields: ['description'] });
    expect(notOwner.errors[0]).toMatchObject({ code: 'HOOK_ERROR' });
  });

  test('staff with portals all: update-only does not participate', async () => {
    const denied = await pkit.validate({ action: 'marketing.portals', method: 'update', role: 'staff', permissions: [STAFF_PORTALS_ALL], data: PORTAL });

    expect(denied.errors[0]?.code).toBe('METHOD_DISABLED');
  });

  test('admin with no assignments: PERMISSION_NOT_ASSIGNED', async () => {
    const denied = await pkit.validate({ action: 'marketing.portals', method: 'find', role: 'admin', permissions: [], data: PORTAL });

    expect(denied.errors[0]?.code).toBe('PERMISSION_NOT_ASSIGNED');
  });

  test('staff with portals all and update-only: AMBIGUOUS_PERMISSION', async () => {
    const denied = await pkit.validate({ action: 'marketing.portals', method: 'find', role: 'staff', permissions: [STAFF_PORTALS_ALL, STAFF_PORTALS_UPDATE_ONLY], data: PORTAL });

    expect(denied.errors[0]?.code).toBe('AMBIGUOUS_PERMISSION');
  });

  test('staff with a row of admin prefix: PERMISSION_ROLE_MISMATCH', async () => {
    const denied = await pkit.validate({ action: 'marketing.portals', method: 'find', role: 'staff', permissions: [ADMIN_PORTALS_ALL], data: PORTAL });

    expect(denied.errors[0]?.code).toBe('PERMISSION_ROLE_MISMATCH');
  });

  test('staff with a row whose name no longer exists: UNKNOWN_PERMISSION', async () => {
    const denied = await pkit.validate({ action: 'marketing.portals', method: 'find', role: 'staff', permissions: ['staff::marketing.portals::legacy'], data: PORTAL });

    expect(denied.errors[0]?.code).toBe('UNKNOWN_PERMISSION');
  });

  test('module hook on remove denies published portals', async () => {
    const denied = await pkit.validate({ action: 'marketing.portals', method: 'remove', role: 'admin', permissions: [ADMIN_PORTALS_ALL], data: { id: 1, status: 'published' } });

    expect(denied.errors[0]).toMatchObject({ code: 'PROPERTIES_NOT_ALLOWED', fields: ['status'] });

    pkit.context.set('cropper', true);

    const cropped = await pkit.validate({ action: 'marketing.portals', method: 'remove', role: 'admin', permissions: [ADMIN_PORTALS_ALL], data: { id: 1, status: 'published' } });

    expect(cropped.errors).toEqual([]);
    expect(cropped.result?.data).toEqual({ id: 1 });
  });

  test('forUser for the staff user with dashboard', () => {
    const access = pkit.permissions.forUser({ role: 'staff', permissions: [STAFF_DASHBOARD] });

    expect(access).toEqual({
      'staff::marketing.portals::all': { find: true, update: false, create: false, remove: false },
      'staff::marketing.dashboard::all': { find: true, update: false, create: false, remove: false },
    });
    expect(Object.isFrozen(access)).toBe(true);
    expect(Object.getPrototypeOf(access)).toBeNull();
    expect(Object.keys(pkit.permissions.named).sort()).toEqual([
      ADMIN_DASHBOARD, ADMIN_PORTALS_ALL, STAFF_DASHBOARD, STAFF_PORTALS_ALL, STAFF_PORTALS_UPDATE_ONLY,
    ].sort());
  });
});
