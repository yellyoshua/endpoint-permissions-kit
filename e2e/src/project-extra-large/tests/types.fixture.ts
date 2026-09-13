import pkit from 'endpoint-permissions-kit';
import type { PermissionId, Role } from 'endpoint-permissions-kit';

const auditorRole: Role = 'auditor';
const validId: PermissionId = 'auditor::xl.finance.ledger.entries::all';

// @ts-expect-error role outside the generated catalog
const undeclaredRole: Role = 'tenant';

// @ts-expect-error identifier with an undeclared role prefix
const foreignId: PermissionId = 'tenant::xl.finance.ledger.entries::all';

const entries = pkit.module('xl').module('finance').module('ledger').module('entries').name('all');

entries.role('finance').registerActions({ find: { enabled: true, properties: '*' } });

// @ts-expect-error role outside the generated catalog cannot register actions
entries.role('tenant').registerActions({ find: { enabled: true, properties: ['id'] } });

// @ts-expect-error grants require enabled: true
entries.grantTo('analyst::xl.analytics.reports::all').registerActions({ find: { enabled: false, properties: ['id'] } });

// @ts-expect-error grants require an explicit property list
entries.grantTo('analyst::xl.analytics.reports::all').registerActions({ find: { enabled: true, properties: '*' } });

void pkit.validate({ action: 'xl.finance.ledger.entries', name: 'all', method: 'find', role: auditorRole, permissions: [validId], select: ['id'] });

void pkit.validate({ action: 'xl.finance.ledger.entries', name: 'all', method: 'update', role: auditorRole, permissions: [validId], data: { memo: 'x' } });

// @ts-expect-error select is only valid on find
void pkit.validate({ action: 'xl.finance.ledger.entries', name: 'all', method: 'update', role: auditorRole, permissions: [validId], data: {}, select: ['id'] });

// @ts-expect-error update requires data
void pkit.validate({ action: 'xl.finance.ledger.entries', name: 'all', method: 'update', role: auditorRole, permissions: [validId] });

export { undeclaredRole, foreignId };
