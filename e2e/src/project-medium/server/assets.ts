import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import type { RequestContext } from '../../server/requestContext';
import { ALL_NAME, ASSETS_ACTION, UPDATE_ONLY_NAME } from './permissions';
import { deleteAsset, findAsset, insertAsset, listAssets, replaceAsset, type Asset } from './store';

const ASSETS_ALL = { action: ASSETS_ACTION, name: ALL_NAME };
const ASSETS_UPDATE_ONLY = { action: ASSETS_ACTION, name: UPDATE_ONLY_NAME };
const DEFAULT_BUDGET = 0;

interface ListAssetsRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly select?: readonly string[];
}

interface CreateAssetRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly data: Data;
}

interface UpdateAssetRequest extends CreateAssetRequest {
  readonly id: string;
}

interface RemoveAssetRequest {
  readonly identity: Identity;
  readonly context: RequestContext;
  readonly id: string;
}

function applyAssetFields(existing: Asset, data: Data): Asset {
  return {
    ...existing,
    title: typeof data.title === 'string' ? data.title : existing.title,
    campaign: typeof data.campaign === 'string' ? data.campaign : existing.campaign,
    status: typeof data.status === 'string' ? data.status : existing.status,
  };
}

export async function listAllAssets(request: ListAssetsRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: ASSETS_ALL, identity: request.identity, select: request.select, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listAssets().map((asset) => projectRecord(asset, authorization.result)));
}

export async function listEditableAssets(request: ListAssetsRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: ASSETS_UPDATE_ONLY, identity: request.identity, select: request.select, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listAssets().map((asset) => projectRecord(asset, authorization.result)));
}

export async function createAsset(request: CreateAssetRequest): Promise<UseCaseResult<Asset>> {
  const authorization = await authorizeWrite({ guard: ASSETS_ALL, identity: request.identity, method: 'create', data: request.data, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const created = insertAsset({
    title: String(authorization.result.title ?? ''),
    campaign: String(authorization.result.campaign ?? ''),
    status: String(authorization.result.status ?? 'draft'),
    budget: DEFAULT_BUDGET,
  });
  return succeed(created);
}

export async function updateAsset(request: UpdateAssetRequest): Promise<UseCaseResult<Asset>> {
  const authorization = await authorizeWrite({ guard: ASSETS_ALL, identity: request.identity, method: 'update', data: request.data, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const existing = findAsset(request.id);
  if (existing === undefined) return notFound();
  const updated = applyAssetFields(existing, authorization.result);
  replaceAsset(updated);
  return succeed(updated);
}

export async function updateEditableAsset(request: UpdateAssetRequest): Promise<UseCaseResult<Asset>> {
  const authorization = await authorizeWrite({ guard: ASSETS_UPDATE_ONLY, identity: request.identity, method: 'update', data: request.data, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const existing = findAsset(request.id);
  if (existing === undefined) return notFound();
  const updated = applyAssetFields(existing, authorization.result);
  replaceAsset(updated);
  return succeed(updated);
}

export async function removeAsset(request: RemoveAssetRequest): Promise<UseCaseResult<undefined>> {
  const authorization = await authorizeWrite({ guard: ASSETS_ALL, identity: request.identity, method: 'remove', data: { id: request.id }, context: request.context });
  if (!authorization.isAllowed) return deny(authorization.errors);
  if (findAsset(request.id) === undefined) return notFound();
  deleteAsset(request.id);
  return succeed(undefined);
}
