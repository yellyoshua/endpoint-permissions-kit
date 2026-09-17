import type { Registry } from './registry';
import type { ActionDefs, HookFn, Method } from './types';
import registry from './registry';

export default class RoleBuilder<R extends string> {
  readonly #registry: Registry;

  readonly #module: string;

  readonly #name: string;

  readonly #role: R;

  constructor(target: Registry, modulePath: string, name: string, role: string) {
    this.#registry = target;
    this.#module = modulePath;
    this.#name = name;
    this.#role = role as R;

    this.registerActions = this.registerActions.bind(this);
    this.hook = this.hook.bind(this);
  }

  registerActions(actions: ActionDefs): this {
    registry.registerActions(this.#registry, this.#module, this.#name, this.#role, actions);

    return this;
  }

  hook(method: Method, fn: HookFn): this {
    registry.registerRoleHook(this.#registry, this.#module, this.#name, this.#role, method, fn);

    return this;
  }
}
