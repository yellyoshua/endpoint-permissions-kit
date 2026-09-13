import { Router } from 'express';
import { asData, parseSelect } from '../../server/body';
import { createCatalogHandler } from '../../server/catalogRoute';
import { invalidBody } from '../../server/errors';
import { createIdentityMiddleware } from '../../server/identity';
import meHandler from '../../server/meRoute';
import { buildRequestContext } from '../../server/requestContext';
import { HTTP_CREATED, HTTP_NO_CONTENT, HTTP_OK, respond } from '../../server/respond';
import { ALL_NAME, MODULE_PREFIX, TAGS_ACTION } from './permissions';
import { createNote, listAllNotes, listPublishedNotes, removeNote, updateNote } from './notes';
import { showOwnProfile, updateOwnProfile } from './profile';
import { ANONYMOUS_IDENTITY, findUser } from './store';
import { createTag, listAllTags, removeTag } from './tags';

const BODY_MUST_BE_OBJECT = 'body must be a JSON object';

const router = Router();

router.use(createIdentityMiddleware({ findUser, anonymous: ANONYMOUS_IDENTITY }));

router.get('/me', meHandler);
router.get('/catalog', createCatalogHandler({ modulePrefix: MODULE_PREFIX, guard: { action: TAGS_ACTION, name: ALL_NAME } }));

router.get('/notes', async (req, res) => {
  respond(res, await listAllNotes({ identity: res.locals.identity, context: buildRequestContext(req, res), select: parseSelect(req.query.select) }), HTTP_OK);
});

router.get('/notes/published', async (req, res) => {
  respond(res, await listPublishedNotes({ identity: res.locals.identity, context: buildRequestContext(req, res), select: parseSelect(req.query.select) }), HTTP_OK);
});

router.post('/notes', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_CREATED);
    return;
  }
  respond(res, await createNote({ identity: res.locals.identity, context: buildRequestContext(req, res), data }), HTTP_CREATED);
});

router.patch('/notes/:id', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_OK);
    return;
  }
  respond(res, await updateNote({ identity: res.locals.identity, context: buildRequestContext(req, res), id: req.params.id, data }), HTTP_OK);
});

router.delete('/notes/:id', async (req, res) => {
  respond(res, await removeNote({ identity: res.locals.identity, context: buildRequestContext(req, res), id: req.params.id }), HTTP_NO_CONTENT);
});

router.get('/tags', async (req, res) => {
  respond(res, await listAllTags({ identity: res.locals.identity, context: buildRequestContext(req, res), select: parseSelect(req.query.select) }), HTTP_OK);
});

router.post('/tags', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_CREATED);
    return;
  }
  respond(res, await createTag({ identity: res.locals.identity, context: buildRequestContext(req, res), data }), HTTP_CREATED);
});

router.delete('/tags/:id', async (req, res) => {
  respond(res, await removeTag({ identity: res.locals.identity, context: buildRequestContext(req, res), id: req.params.id }), HTTP_NO_CONTENT);
});

router.get('/profile', async (req, res) => {
  respond(res, await showOwnProfile({ identity: res.locals.identity, context: buildRequestContext(req, res), select: parseSelect(req.query.select) }), HTTP_OK);
});

router.patch('/profile', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_OK);
    return;
  }
  respond(res, await updateOwnProfile({ identity: res.locals.identity, context: buildRequestContext(req, res), data }), HTTP_OK);
});

export default router;
