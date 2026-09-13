import pkit from 'endpoint-permissions-kit';
import { reportErrorCode } from './report';

pkit.context.set('roles', ['admin']);
const settings = pkit.module('xl').module('platform').module('tenants').module('settings').name('all');

reportErrorCode(() => {
  settings.role('owner').registerActions({ find: { enabled: true, properties: ['id'] } });
});
