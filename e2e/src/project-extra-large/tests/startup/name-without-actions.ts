import pkit from 'endpoint-permissions-kit';
import { reportErrorCode } from './report';

pkit.context.set('roles', ['admin']);
const settings = pkit.module('xl').module('platform').module('tenants').module('settings');
settings.name('all').role('admin').registerActions({ find: { enabled: true, properties: ['id'] } });
settings.name('archive').hook('find', () => undefined);

reportErrorCode(() => {
  pkit.seal();
});
