import { describe, expect, test } from 'bun:test';
import type { Request, Response } from 'express';
import type { Identity } from '../../server/identity';
import { buildRequestContext, readRequestContext, resourceIdOf, sessionUserIdOf } from '../../server/requestContext';

const MEMBER: Identity = { id: 'mia', role: 'member', permissions: ['member::small.notes::all'] };

function fakeRequest(params: Record<string, string>): Request {
  return { baseUrl: '/api/small', path: '/notes/n1', params } as unknown as Request;
}

function fakeResponse(identity: Identity, sessionUser: Identity | null): Response {
  return { locals: { identity, sessionUser } } as unknown as Response;
}

describe('small: base request context handed to hooks', () => {
  test('carries user, path, permissions and params for a session user', () => {
    const context = buildRequestContext(fakeRequest({ id: 'n1' }), fakeResponse(MEMBER, MEMBER));
    expect(context).toEqual({ user: MEMBER, path: '/api/small/notes/n1', permissions: MEMBER.permissions, params: { id: 'n1' } });
    expect(resourceIdOf(context)).toBe('n1');
    expect(sessionUserIdOf(context)).toBe('mia');
  });

  test('anonymous identity yields user null but keeps its fixed permission list', () => {
    const anonymous: Identity = { id: 'anonymous', role: 'public', permissions: ['public::small.notes::read-only'] };
    const context = buildRequestContext(fakeRequest({}), fakeResponse(anonymous, null));
    expect(context.user).toBeNull();
    expect(context.permissions).toEqual(anonymous.permissions);
    expect(sessionUserIdOf(context)).toBeUndefined();
    expect(resourceIdOf(context)).toBeUndefined();
  });

  test('readRequestContext rejects contexts without the base shape', () => {
    expect(readRequestContext(undefined)).toBeUndefined();
    expect(readRequestContext({ user: { id: 'x' } })).toBeUndefined();
  });
});
