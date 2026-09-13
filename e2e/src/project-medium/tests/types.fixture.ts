import pkit from 'endpoint-permissions-kit';
import type { PermissionId, Role } from 'endpoint-permissions-kit';

const staffRole: Role = 'staff';
const validId: PermissionId = 'staff::medium.marketing.portals::update-only';

// @ts-expect-error role outside the generated catalog
const undeclaredRole: Role = 'wizard';

// @ts-expect-error identifier with an undeclared role prefix
const foreignId: PermissionId = 'wizard::medium.marketing.portals::all';

const portals = pkit.module('medium').module('marketing').module('portals').name('all');

portals.role('staff').registerActions({ find: { enabled: true, properties: ['id', 'name', 'assetId'] } });

// @ts-expect-error role outside the generated catalog cannot register actions
portals.role('wizard').registerActions({ find: { enabled: true, properties: ['id'] } });

// @ts-expect-error grants require enabled: true
portals.grantTo('staff::medium.marketing.dashboard::all').registerActions({ find: { enabled: false, properties: ['id'] } });

// @ts-expect-error grants require an explicit property list
portals.grantTo('admin::medium.marketing.dashboard::all').registerActions({ find: { enabled: true, properties: '*' } });

void pkit.validate({ action: 'medium.marketing.portals', name: 'all', method: 'find', role: staffRole, permissions: [validId], select: ['id'] });

void pkit.validate({ action: 'medium.marketing.portals', name: 'update-only', method: 'update', role: staffRole, permissions: [validId], data: { name: 'x' } });

// @ts-expect-error select is only valid on find
void pkit.validate({ action: 'medium.marketing.portals', name: 'update-only', method: 'update', role: staffRole, permissions: [validId], data: {}, select: ['id'] });

// @ts-expect-error update requires data
void pkit.validate({ action: 'medium.marketing.portals', name: 'update-only', method: 'update', role: staffRole, permissions: [validId] });

export { undeclaredRole, foreignId };
