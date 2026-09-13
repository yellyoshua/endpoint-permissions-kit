import pkit from 'endpoint-permissions-kit';
import type { Context, Data, ResolvedPermission } from 'endpoint-permissions-kit';

export const MODULE_PREFIX = 'medium';

export const PORTALS_ACTION = 'medium.marketing.portals';
export const DASHBOARD_ACTION = 'medium.marketing.dashboard';
export const ASSETS_ACTION = 'medium.campaigns.assets';

export const ALL_NAME = 'all';
export const UPDATE_ONLY_NAME = 'update-only';
export const SETTINGS_NAME = 'settings';

export const STAFF_DASHBOARD_ID = 'staff::medium.marketing.dashboard::all';
export const ADMIN_DASHBOARD_ID = 'admin::medium.marketing.dashboard::all';

export const PUBLISHED_PORTAL_MESSAGE = 'Published portals cannot be removed';
export const PORTAL_OWNER_MESSAGE = 'Only the owner can update this portal';
export const DASHBOARD_PORTAL_ACCESS_MESSAGE = 'Portal access from dashboard is not allowed';
export const PUBLISHED_ASSET_MESSAGE = 'Published assets cannot be edited';

const PORTAL_GRANT_FIELDS = ['id', 'name', 'assetId'];

const root = pkit.module(MODULE_PREFIX);
const marketing = root.module('marketing');
const campaigns = root.module('campaigns');

const portals = marketing.module('portals');
const portalsAll = portals.name(ALL_NAME);
const portalsUpdateOnly = portals.name(UPDATE_ONLY_NAME);
const dashboard = marketing.module('dashboard').name(ALL_NAME);
const dashboardSettings = marketing.module('dashboard').name(SETTINGS_NAME);
const assets = campaigns.module('assets');
const assetsAll = assets.name(ALL_NAME);
const assetsUpdateOnly = assets.name(UPDATE_ONLY_NAME);

portalsAll.role('staff').registerActions({
  find: { enabled: true, properties: PORTAL_GRANT_FIELDS },
});

portalsAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: ['id'] },
});

portalsUpdateOnly.role('staff').registerActions({
  find: { enabled: true, properties: PORTAL_GRANT_FIELDS },
  update: { enabled: true, properties: PORTAL_GRANT_FIELDS },
});

portalsAll.grantTo(ADMIN_DASHBOARD_ID).registerActions({
  find: { enabled: true, properties: PORTAL_GRANT_FIELDS },
});

portalsAll.grantTo(STAFF_DASHBOARD_ID).registerActions({
  find: { enabled: true, properties: PORTAL_GRANT_FIELDS },
});

portalsUpdateOnly.grantTo(STAFF_DASHBOARD_ID).registerActions({
  find: { enabled: true, properties: PORTAL_GRANT_FIELDS },
});

portalsUpdateOnly.grantTo(ADMIN_DASHBOARD_ID).registerActions({
  find: { enabled: true, properties: PORTAL_GRANT_FIELDS },
});

dashboard.role('staff').registerActions({
  find: { enabled: true, properties: '*' },
});

dashboard.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
});

dashboard.role('analyst').registerActions({
  find: { enabled: true, properties: '*' },
});

dashboardSettings.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
});

assetsAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  create: { enabled: true, properties: ['title', 'campaign', 'status'] },
  update: { enabled: true, properties: ['title', 'campaign', 'status'] },
  remove: { enabled: true, properties: ['id'] },
});

assetsAll.role('analyst').registerActions({
  find: { enabled: true, properties: ['id', 'title', 'campaign', 'status'] },
});

assetsUpdateOnly.role('intern').registerActions({
  find: { enabled: true, properties: ['id', 'title', 'campaign'] },
  update: { enabled: true, properties: ['title'] },
});

interface StatusResource {
  readonly status?: string;
  readonly owner?: string;
}

interface HookUser {
  readonly id?: string;
}

function checkPublishedPortal(_data: Data | undefined, context: Context | undefined): void {
  const resource = context?.resource as StatusResource | undefined;
  if (resource?.status === 'published') throw new Error(PUBLISHED_PORTAL_MESSAGE);
}

function checkPortalOwner(_data: Data | undefined, context: Context | undefined): void {
  const resource = context?.resource as StatusResource | undefined;
  const user = context?.user as HookUser | undefined;
  if (resource?.owner !== user?.id) throw new Error(PORTAL_OWNER_MESSAGE);
}

function checkDashboardPortalAccess(_data: Data | undefined, context: Context | undefined, permission: ResolvedPermission): void {
  if (!permission.authorization.grantedBy.includes(STAFF_DASHBOARD_ID)) return;
  if (context?.allowDashboardPortalAccess !== true) throw new Error(DASHBOARD_PORTAL_ACCESS_MESSAGE);
}

function checkPublishedAsset(_data: Data | undefined, context: Context | undefined): void {
  const resource = context?.resource as StatusResource | undefined;
  if (resource?.status === 'published') throw new Error(PUBLISHED_ASSET_MESSAGE);
}

portals.hook('remove', checkPublishedPortal);
portalsUpdateOnly.role('staff').hook('update', checkPortalOwner);
portalsAll.role('staff').hook('find', checkDashboardPortalAccess);
assetsUpdateOnly.hook('update', checkPublishedAsset);
