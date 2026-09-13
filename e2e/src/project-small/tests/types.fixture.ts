import pkit from 'endpoint-permissions-kit';
import type { PermissionId, Role } from 'endpoint-permissions-kit';

const memberRole: Role = 'member';
const validId: PermissionId = 'member::small.notes::all';

// @ts-expect-error role outside the generated catalog
const undeclaredRole: Role = 'wizard';

// @ts-expect-error identifier with an undeclared role prefix
const foreignId: PermissionId = 'wizard::small.notes::all';

const notes = pkit.module('small').module('notes').name('all');

notes.role('member').registerActions({ find: { enabled: true, properties: ['id'] } });

// @ts-expect-error role outside the generated catalog cannot register actions
notes.role('wizard').registerActions({ find: { enabled: true, properties: ['id'] } });

// @ts-expect-error grants require enabled: true
notes.grantTo('member::small.tags::all').registerActions({ find: { enabled: false, properties: ['id'] } });

// @ts-expect-error grants require an explicit property list
notes.grantTo('member::small.tags::all').registerActions({ find: { enabled: true, properties: '*' } });

void pkit.validate({ action: 'small.notes', name: 'all', method: 'find', role: memberRole, permissions: [validId], select: ['id'] });

void pkit.validate({ action: 'small.notes', name: 'all', method: 'update', role: memberRole, permissions: [validId], data: { title: 'x' } });

// @ts-expect-error select is only valid on find
void pkit.validate({ action: 'small.notes', name: 'all', method: 'update', role: memberRole, permissions: [validId], data: {}, select: ['id'] });

// @ts-expect-error update requires data
void pkit.validate({ action: 'small.notes', name: 'all', method: 'update', role: memberRole, permissions: [validId] });

export { undeclaredRole, foreignId };
