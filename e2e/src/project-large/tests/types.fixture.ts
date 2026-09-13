import pkit from 'endpoint-permissions-kit';
import type { PermissionId, Role } from 'endpoint-permissions-kit';

const salesRole: Role = 'sales';
const validId: PermissionId = 'sales::large.sales.orders::all';

// @ts-expect-error role outside the generated catalog
const undeclaredRole: Role = 'clerk';

// @ts-expect-error identifier with an undeclared role prefix
const foreignId: PermissionId = 'clerk::large.sales.orders::all';

const lines = pkit.module('large').module('sales').module('orders').module('lines').name('all');

lines.role('sales').registerActions({ find: { enabled: true, properties: ['id'] } });

// @ts-expect-error role outside the generated catalog cannot register actions
lines.role('clerk').registerActions({ find: { enabled: true, properties: ['id'] } });

// @ts-expect-error grants require enabled: true
lines.grantTo('sales::large.sales.orders::all').registerActions({ find: { enabled: false, properties: ['id'] } });

// @ts-expect-error grants require an explicit property list
lines.grantTo('sales::large.sales.orders::all').registerActions({ find: { enabled: true, properties: '*' } });

void pkit.validate({ action: 'large.sales.orders.lines', name: 'all', method: 'find', role: salesRole, permissions: [validId], select: ['id'] });

void pkit.validate({ action: 'large.sales.orders.lines', name: 'all', method: 'update', role: salesRole, permissions: [validId], data: { quantity: 1 } });

// @ts-expect-error select is only valid on find
void pkit.validate({ action: 'large.sales.orders.lines', name: 'all', method: 'update', role: salesRole, permissions: [validId], data: {}, select: ['id'] });

// @ts-expect-error update requires data
void pkit.validate({ action: 'large.sales.orders.lines', name: 'all', method: 'update', role: salesRole, permissions: [validId] });

export { undeclaredRole, foreignId };
