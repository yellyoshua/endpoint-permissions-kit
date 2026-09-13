import pkit from 'endpoint-permissions-kit';
import { reportValidationCode } from './report';

pkit.context.set('roles', ['admin']);
const settings = pkit.module('xl').module('platform').module('tenants').module('settings').name('all');
settings.role('admin').registerActions({ find: { enabled: true, properties: ['id'] } });
pkit.seal();

reportValidationCode(await pkit.validate({
  action: 'xl.platform.tenants.missing',
  name: 'all',
  method: 'find',
  role: 'admin',
  permissions: ['admin::xl.platform.tenants.settings::all'],
}));
