import { describe, test, expect } from 'bun:test';

describe('Built Package Imports (ESM & CommonJS)', () => {
  test('should import and execute ESM build correctly', async () => {
    // @ts-ignore - testing generated javascript build file
    const esmModule = await import('../dist/esm/index.js');
    expect(esmModule.createPermissions).toBeDefined();

    const kit = esmModule.createPermissions();
    kit.addRule({ role: 'admin', action: 'read', resource: 'analytics' });
    expect(kit.can('admin', 'read', 'analytics')).toBe(true);
  });

  test('should require and execute CommonJS build correctly', () => {
    // @ts-ignore - testing generated javascript build file
    const cjsModule = require('../dist/cjs/index.js');
    expect(cjsModule.createPermissions).toBeDefined();

    const kit = cjsModule.createPermissions();
    kit.addRule({ role: 'editor', action: 'write', resource: 'articles' });
    expect(kit.can('editor', 'write', 'articles')).toBe(true);
  });
});
