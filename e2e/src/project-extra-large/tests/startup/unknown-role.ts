import pkit from 'endpoint-permissions-kit';
import type { Role } from 'endpoint-permissions-kit';
import { reportValidationCode } from './report';

pkit.context.set('roles', ['admin']);
const settings = pkit.module('xl').module('platform').module('tenants').module('settings').name('all');
settings.role('admin').registerActions({ find: { enabled: true, properties: ['id'] } });
pkit.seal();

const corruptSessionRole = 'nobody' as Role;
reportValidationCode(await pkit.validate({
  action: 'xl.platform.tenants.settings',
  name: 'all',
  method: 'find',
  role: corruptSessionRole,
  permissions: ['admin::xl.platform.tenants.settings::all'],
}));
