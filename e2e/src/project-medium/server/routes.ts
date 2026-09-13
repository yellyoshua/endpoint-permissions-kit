import { Router } from 'express';
import { asData, parseSelect } from '../../server/body';
import { createCatalogHandler } from '../../server/catalogRoute';
import { invalidBody } from '../../server/errors';
import { createIdentityMiddleware } from '../../server/identity';
import meHandler from '../../server/meRoute';
import { HTTP_CREATED, HTTP_NO_CONTENT, HTTP_OK, respond } from '../../server/respond';
import { DASHBOARD_ACTION, MODULE_PREFIX, SETTINGS_NAME } from './permissions';
import { createAsset, listAllAssets, listEditableAssets, removeAsset, updateAsset, updateEditableAsset } from './assets';
import { listDashboardWidgets } from './dashboard';
import { listAllPortals, listEditablePortals, removePortal, updateEditablePortal } from './portals';
import { findUser } from './store';

const BODY_MUST_BE_OBJECT = 'body must be a JSON object';

const router = Router();

router.use(createIdentityMiddleware({ findUser }));

router.get('/me', meHandler);
router.get('/catalog', createCatalogHandler({ modulePrefix: MODULE_PREFIX, guard: { action: DASHBOARD_ACTION, name: SETTINGS_NAME } }));

router.get('/marketing/dashboard', async (req, res) => {
  respond(res, await listDashboardWidgets({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.get('/marketing/portals', async (req, res) => {
  respond(res, await listAllPortals({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.delete('/marketing/portals/:id', async (req, res) => {
  respond(res, await removePortal({ identity: res.locals.identity, id: req.params.id }), HTTP_NO_CONTENT);
});

router.get('/marketing/portals/editable', async (req, res) => {
  respond(res, await listEditablePortals({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.patch('/marketing/portals/editable/:id', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_OK);
    return;
  }
  respond(res, await updateEditablePortal({ identity: res.locals.identity, id: req.params.id, data }), HTTP_OK);
});

router.get('/campaigns/assets', async (req, res) => {
  respond(res, await listAllAssets({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.post('/campaigns/assets', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_CREATED);
    return;
  }
  respond(res, await createAsset({ identity: res.locals.identity, data }), HTTP_CREATED);
});

router.get('/campaigns/assets/editable', async (req, res) => {
  respond(res, await listEditableAssets({ identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
});

router.patch('/campaigns/assets/editable/:id', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_OK);
    return;
  }
  respond(res, await updateEditableAsset({ identity: res.locals.identity, id: req.params.id, data }), HTTP_OK);
});

router.patch('/campaigns/assets/:id', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_OK);
    return;
  }
  respond(res, await updateAsset({ identity: res.locals.identity, id: req.params.id, data }), HTTP_OK);
});

router.delete('/campaigns/assets/:id', async (req, res) => {
  respond(res, await removeAsset({ identity: res.locals.identity, id: req.params.id }), HTTP_NO_CONTENT);
});

export default router;
