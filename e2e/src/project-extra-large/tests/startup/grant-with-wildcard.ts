import pkit from 'endpoint-permissions-kit';
import { reportErrorCode } from './report';

pkit.context.set('roles', ['admin']);
const settings = pkit.module('xl').module('platform').module('tenants').module('settings').name('all');
settings.role('admin').registerActions({ find: { enabled: true, properties: ['id'] } });
const wildcard = '*' as unknown as readonly string[];

reportErrorCode(() => {
  settings.grantTo('admin::xl.platform.tenants.members::all').registerActions({ find: { enabled: true, properties: wildcard } });
});
