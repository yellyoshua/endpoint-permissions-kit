import pkit from 'endpoint-permissions-kit';
import { reportErrorCode } from './report';

pkit.context.set('roles', ['admin']);
const settings = pkit.module('xl').module('platform').module('tenants').module('settings').name('all');
settings.role('admin').registerActions({ find: { enabled: true, properties: ['id'] } });

reportErrorCode(() => {
  settings.role('admin').registerActions({ find: { enabled: true, properties: ['id', 'name'] } });
});
