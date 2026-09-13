import pkit from 'endpoint-permissions-kit';
import type { Data } from 'endpoint-permissions-kit';
import { reportValidationCode } from './report';

pkit.context.set('roles', ['admin']);
const settings = pkit.module('xl').module('platform').module('tenants').module('settings').name('all');
settings.role('admin').registerActions({ update: { enabled: true, properties: ['name'] } });
pkit.seal();

const explodingData: Data = new Proxy({}, {
  ownKeys() {
    throw new Error('data cannot be enumerated');
  },
});

reportValidationCode(await pkit.validate({
  action: 'xl.platform.tenants.settings',
  name: 'all',
  method: 'update',
  role: 'admin',
  permissions: ['admin::xl.platform.tenants.settings::all'],
  data: explodingData,
}));
