import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, projectRecord } from '../../server/authorize';
import { deny, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import type { RequestContext } from '../../server/requestContext';
import { ALL_NAME, DASHBOARD_ACTION } from './permissions';
import { listWidgets } from './store';

const DASHBOARD_ALL = { action: DASHBOARD_ACTION, name: ALL_NAME };

interface ListWidgetsRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly select?: readonly string[];
}

export async function listDashboardWidgets(request: ListWidgetsRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: DASHBOARD_ALL, identity: request.identity, select: request.select, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listWidgets().map((widget) => projectRecord(widget, authorization.result)));
}
