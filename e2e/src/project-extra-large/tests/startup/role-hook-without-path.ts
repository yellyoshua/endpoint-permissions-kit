import pkit from 'endpoint-permissions-kit';
import { reportErrorCode } from './report';

pkit.context.set('roles', ['admin', 'auditor']);
const settings = pkit.module('xl').module('platform').module('tenants').module('settings').name('all');
settings.role('admin').registerActions({ find: { enabled: true, properties: ['id'] } });
settings.role('auditor').hook('find', () => undefined);

reportErrorCode(() => {
  pkit.seal();
});
