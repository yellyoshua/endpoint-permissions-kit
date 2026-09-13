import pkit from 'endpoint-permissions-kit';
import { reportErrorCode } from './report';

pkit.context.set('roles', ['admin']);
pkit.module('xl').module('platform').module('tenants').module('settings').name('all').role('admin').registerActions({ find: { enabled: true, properties: ['id'] } });

reportErrorCode(() => {
  pkit.context.set('roles', ['admin', 'owner']);
});
