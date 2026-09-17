import type { Registry } from './registry';
import type { HookFn, Method, PermissionId } from './types';
import GrantBuilder from './grant-builder';
import RoleBuilder from './role-builder';
import identifiers from './identifiers';
import registry from './registry';

export default class NameBuilder<R extends string> {
  readonly #registry: Registry;

  readonly #module: string;

  readonly #name: string;

  readonly #roles: Map<string, RoleBuilder<R>>;

  constructor(target: Registry, modulePath: string, name: string) {
    identifiers.checkName(name);

    this.#registry = target;
    this.#module = modulePath;
    this.#name = name;
    this.#roles = new Map();

    this.role = this.role.bind(this);
    this.grantTo = this.grantTo.bind(this);
    this.hook = this.hook.bind(this);
  }

  role(role: R): RoleBuilder<R> {
    const existing = this.#roles.get(role);

    if (existing !== undefined) return existing;

    const created = new RoleBuilder<R>(this.#registry, this.#module, this.#name, registry.checkRole(this.#registry, role));

    this.#roles.set(role, created);

    return created;
  }

  grantTo(permissionId: PermissionId<R>): GrantBuilder {
    return new GrantBuilder(this.#registry, this.#module, this.#name, permissionId);
  }

  hook(method: Method, fn: HookFn): this {
    registry.registerNameHook(this.#registry, this.#module, this.#name, method, fn);

    return this;
  }
}
