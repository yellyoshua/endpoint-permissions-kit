import { Router, type Request, type Response } from 'express';
import { asData, parseSelect } from '../../server/body';
import { createCatalogHandler } from '../../server/catalogRoute';
import { invalidBody } from '../../server/errors';
import { createIdentityMiddleware } from '../../server/identity';
import meHandler from '../../server/meRoute';
import { HTTP_CREATED, HTTP_NO_CONTENT, HTTP_OK, respond } from '../../server/respond';
import { createRecord, listRecords, removeRecord, updateRecord, type Resource } from './collection';
import { importMember, inviteMember } from './members';
import { MODULE_PREFIX } from './permissions';
import { createReply, listReplies } from './replies';
import {
  BLOCKS_ALL,
  ENTRIES_ALL,
  ENTRIES_SUMMARY,
  MEMBERS_ALL,
  NOTES_ALL,
  NOTES_READ_ONLY,
  PAGES_PUBLISHED,
  REPLIES_ALL,
  REPORTS_ALL,
  REPORTS_READ_ONLY,
  SETTINGS_ALL,
} from './resources';
import { ANONYMOUS_IDENTITY, findUser } from './store';
import { assignPermissionsToUser } from './users';

type IdRequest = Request<{ id: string }>;

const BODY_MUST_BE_OBJECT = 'body must be a JSON object';

const router = Router();

router.use(createIdentityMiddleware({ findUser, anonymous: ANONYMOUS_IDENTITY }));

router.get('/me', meHandler);
router.get('/catalog', createCatalogHandler({ modulePrefix: MODULE_PREFIX, guard: SETTINGS_ALL.guard }));

function mountList(path: string, resource: Resource): void {
  router.get(path, async (req: Request, res: Response) => {
    respond(res, await listRecords({ resource, identity: res.locals.identity, select: parseSelect(req.query.select) }), HTTP_OK);
  });
}

function mountCreate(path: string, resource: Resource): void {
  router.post(path, async (req: Request, res: Response) => {
    const data = asData(req.body);
    if (data === undefined) {
      respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_CREATED);
      return;
    }
    respond(res, await createRecord({ resource, identity: res.locals.identity, data }), HTTP_CREATED);
  });
}

function mountUpdate(path: string, resource: Resource): void {
  router.patch(`${path}/:id`, async (req: IdRequest, res: Response) => {
    const data = asData(req.body);
    if (data === undefined) {
      respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_OK);
      return;
    }
    respond(res, await updateRecord({ resource, identity: res.locals.identity, id: req.params.id, data }), HTTP_OK);
  });
}

function mountRemove(path: string, resource: Resource): void {
  router.delete(`${path}/:id`, async (req: IdRequest, res: Response) => {
    respond(res, await removeRecord({ resource, identity: res.locals.identity, id: req.params.id }), HTTP_NO_CONTENT);
  });
}

mountList('/platform/tenants/settings', SETTINGS_ALL);
mountCreate('/platform/tenants/settings', SETTINGS_ALL);
mountUpdate('/platform/tenants/settings', SETTINGS_ALL);
mountRemove('/platform/tenants/settings', SETTINGS_ALL);

mountList('/platform/tenants/members', MEMBERS_ALL);
router.post('/platform/tenants/members', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_CREATED);
    return;
  }
  respond(res, await inviteMember({ identity: res.locals.identity, data }), HTTP_CREATED);
});
router.post('/platform/tenants/members/import', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_CREATED);
    return;
  }
  respond(res, await importMember({ identity: res.locals.identity, data }), HTTP_CREATED);
});
mountUpdate('/platform/tenants/members', MEMBERS_ALL);
mountRemove('/platform/tenants/members', MEMBERS_ALL);

mountList('/crm/accounts/contacts/notes/read-only', NOTES_READ_ONLY);
mountList('/crm/accounts/contacts/notes', NOTES_ALL);
mountCreate('/crm/accounts/contacts/notes', NOTES_ALL);
mountUpdate('/crm/accounts/contacts/notes', NOTES_ALL);
mountRemove('/crm/accounts/contacts/notes', NOTES_ALL);

router.get('/support/tickets/replies', async (req, res) => {
  const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;
  respond(res, await listReplies({ identity: res.locals.identity, select: parseSelect(req.query.select), scope }), HTTP_OK);
});
router.post('/support/tickets/replies', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_CREATED);
    return;
  }
  respond(res, await createReply({ identity: res.locals.identity, data }), HTTP_CREATED);
});
mountUpdate('/support/tickets/replies', REPLIES_ALL);
mountRemove('/support/tickets/replies', REPLIES_ALL);

mountList('/finance/ledger/entries/summary', ENTRIES_SUMMARY);
mountList('/finance/ledger/entries', ENTRIES_ALL);
mountCreate('/finance/ledger/entries', ENTRIES_ALL);
mountUpdate('/finance/ledger/entries', ENTRIES_ALL);
mountRemove('/finance/ledger/entries', ENTRIES_ALL);

mountList('/content/pages/published', PAGES_PUBLISHED);

mountList('/content/pages/blocks', BLOCKS_ALL);
mountCreate('/content/pages/blocks', BLOCKS_ALL);
mountUpdate('/content/pages/blocks', BLOCKS_ALL);
mountRemove('/content/pages/blocks', BLOCKS_ALL);

mountList('/analytics/reports/read-only', REPORTS_READ_ONLY);
mountList('/analytics/reports', REPORTS_ALL);
mountCreate('/analytics/reports', REPORTS_ALL);
mountUpdate('/analytics/reports', REPORTS_ALL);
mountRemove('/analytics/reports', REPORTS_ALL);

router.put('/users/:id/permissions', async (req, res) => {
  const data = asData(req.body);
  if (data === undefined) {
    respond(res, invalidBody(BODY_MUST_BE_OBJECT), HTTP_OK);
    return;
  }
  respond(res, await assignPermissionsToUser({ identity: res.locals.identity, userId: req.params.id, permissions: data.permissions }), HTTP_OK);
});

export default router;
