import type { Identity } from '../../server/identity';

export interface Portal {
  readonly id: string;
  readonly name: string;
  readonly assetId: string;
  readonly owner: string;
  readonly status: string;
  readonly internalNotes: string;
}

export interface DashboardWidget {
  readonly id: string;
  readonly title: string;
  readonly visitors: number;
  readonly conversions: number;
}

export interface Asset {
  readonly id: string;
  readonly title: string;
  readonly campaign: string;
  readonly status: string;
  readonly budget: number;
}

export const LIST_LIMIT = 100;

const users = new Map<string, Identity>();
const portals = new Map<string, Portal>();
const widgets = new Map<string, DashboardWidget>();
const assets = new Map<string, Asset>();
const dashboardPortalViewers = new Set<string>();
const nextIdByPrefix = new Map<string, number>();

function allocateId(prefix: string): string {
  const next = nextIdByPrefix.get(prefix) ?? 1;
  nextIdByPrefix.set(prefix, next + 1);
  return `${prefix}${next}`;
}

export function findUser(id: string): Identity | undefined {
  return users.get(id);
}

export function isDashboardPortalViewer(userId: string): boolean {
  return dashboardPortalViewers.has(userId);
}

export function listPortals(): readonly Portal[] {
  return [...portals.values()].slice(0, LIST_LIMIT);
}

export function findPortal(id: string): Portal | undefined {
  return portals.get(id);
}

export function insertPortal(portal: Omit<Portal, 'id'>): Portal {
  const created: Portal = { ...portal, id: allocateId('p') };
  portals.set(created.id, created);
  return created;
}

export function replacePortal(portal: Portal): void {
  portals.set(portal.id, portal);
}

export function deletePortal(id: string): void {
  portals.delete(id);
}

export function listWidgets(): readonly DashboardWidget[] {
  return [...widgets.values()].slice(0, LIST_LIMIT);
}

export function insertWidget(widget: Omit<DashboardWidget, 'id'>): DashboardWidget {
  const created: DashboardWidget = { ...widget, id: allocateId('w') };
  widgets.set(created.id, created);
  return created;
}

export function listAssets(): readonly Asset[] {
  return [...assets.values()].slice(0, LIST_LIMIT);
}

export function findAsset(id: string): Asset | undefined {
  return assets.get(id);
}

export function insertAsset(asset: Omit<Asset, 'id'>): Asset {
  const created: Asset = { ...asset, id: allocateId('a') };
  assets.set(created.id, created);
  return created;
}

export function replaceAsset(asset: Asset): void {
  assets.set(asset.id, asset);
}

export function deleteAsset(id: string): void {
  assets.delete(id);
}

export function reset(): void {
  users.clear();
  portals.clear();
  widgets.clear();
  assets.clear();
  dashboardPortalViewers.clear();
  nextIdByPrefix.clear();
}

export function seed(): void {
  reset();
  users.set('ava', { id: 'ava', role: 'admin', permissions: ['admin::medium.marketing.dashboard::all'] });
  users.set('ben', {
    id: 'ben',
    role: 'admin',
    permissions: [
      'admin::medium.marketing.dashboard::all',
      'admin::medium.marketing.dashboard::settings',
      'admin::medium.marketing.portals::all',
      'admin::medium.campaigns.assets::all',
    ],
  });
  users.set('sam', { id: 'sam', role: 'staff', permissions: ['staff::medium.marketing.dashboard::all'] });
  users.set('tess', { id: 'tess', role: 'staff', permissions: ['staff::medium.marketing.dashboard::all'] });
  users.set('cleo', { id: 'cleo', role: 'staff', permissions: ['staff::medium.marketing.dashboard::all', 'staff::medium.marketing.portals::all'] });
  users.set('dev', { id: 'dev', role: 'staff', permissions: ['staff::medium.marketing.portals::update-only'] });
  users.set('eve', { id: 'eve', role: 'staff', permissions: ['staff::medium.marketing.portals::all'] });
  users.set('nil', { id: 'nil', role: 'admin', permissions: [] });
  users.set('mal', { id: 'mal', role: 'staff', permissions: ['staff::medium.marketing.dashboard::all', 'admin::medium.marketing.portals::all'] });
  users.set('old', { id: 'old', role: 'staff', permissions: ['staff::medium.marketing.portals::legacy'] });
  users.set('ana', { id: 'ana', role: 'analyst', permissions: ['analyst::medium.marketing.dashboard::all', 'analyst::medium.campaigns.assets::all'] });
  users.set('ian', { id: 'ian', role: 'intern', permissions: ['intern::medium.campaigns.assets::update-only'] });
  dashboardPortalViewers.add('sam');
  insertPortal({ name: 'Launch portal', assetId: 'a1', owner: 'dev', status: 'draft', internalNotes: 'pending legal review' });
  insertPortal({ name: 'Partner portal', assetId: 'a2', owner: 'cleo', status: 'published', internalNotes: 'live since Q1' });
  insertWidget({ title: 'Weekly traffic', visitors: 1200, conversions: 48 });
  insertWidget({ title: 'Monthly traffic', visitors: 5100, conversions: 210 });
  insertAsset({ title: 'Launch hero', campaign: 'launch', status: 'draft', budget: 500 });
  insertAsset({ title: 'Partner logo', campaign: 'partners', status: 'published', budget: 250 });
}

seed();
