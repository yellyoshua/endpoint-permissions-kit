import pkit from 'endpoint-permissions-kit';
import type { Context, Data, ResolvedPermission } from 'endpoint-permissions-kit';
import { resourceIdOf, sessionUserIdOf } from '../../server/requestContext';
import { findAsset, findPortal, isDashboardPortalViewer } from './store';

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
export const PUBLISHED_ASSET_REMOVAL_MESSAGE = 'Published assets cannot be removed';
export const ASSET_TITLE_REQUIRED_MESSAGE = 'Asset title is required';

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

function targetPortal(context: Context | undefined) {
  const id = resourceIdOf(context);
  return id === undefined ? undefined : findPortal(id);
}

function targetAsset(context: Context | undefined) {
  const id = resourceIdOf(context);
  return id === undefined ? undefined : findAsset(id);
}

function checkPublishedPortal(_data: Data | undefined, context: Context | undefined): void {
  if (targetPortal(context)?.status === 'published') throw new Error(PUBLISHED_PORTAL_MESSAGE);
}

function checkPortalOwner(_data: Data | undefined, context: Context | undefined): void {
  const portal = targetPortal(context);
  if (portal !== undefined && portal.owner !== sessionUserIdOf(context)) throw new Error(PORTAL_OWNER_MESSAGE);
}

function checkDashboardPortalAccess(_data: Data | undefined, context: Context | undefined, permission: ResolvedPermission): void {
  if (!permission.authorization.grantedBy.includes(STAFF_DASHBOARD_ID)) return;
  const userId = sessionUserIdOf(context);
  if (userId === undefined || !isDashboardPortalViewer(userId)) throw new Error(DASHBOARD_PORTAL_ACCESS_MESSAGE);
}

function checkPublishedAsset(_data: Data | undefined, context: Context | undefined): void {
  if (targetAsset(context)?.status === 'published') throw new Error(PUBLISHED_ASSET_MESSAGE);
}

function checkPublishedAssetRemoval(_data: Data | undefined, context: Context | undefined): void {
  if (targetAsset(context)?.status === 'published') throw new Error(PUBLISHED_ASSET_REMOVAL_MESSAGE);
}

function requireAssetTitle(data: Data | undefined): void {
  if (typeof data?.title !== 'string' || data.title.trim() === '') throw new Error(ASSET_TITLE_REQUIRED_MESSAGE);
}

portals.hook('remove', checkPublishedPortal);
assets.hook('create', requireAssetTitle);
assetsAll.hook('remove', checkPublishedAssetRemoval);
portalsUpdateOnly.role('staff').hook('update', checkPortalOwner);
portalsAll.role('staff').hook('find', checkDashboardPortalAccess);
assetsUpdateOnly.hook('update', checkPublishedAsset);
