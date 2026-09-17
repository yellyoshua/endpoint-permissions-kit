import type { Registry } from './registry';
import type { GrantDefs } from './types';
import registry from './registry';

export default class GrantBuilder {
  readonly #registry: Registry;

  readonly #module: string;

  readonly #name: string;

  readonly #source: string;

  constructor(target: Registry, modulePath: string, name: string, source: string) {
    this.#registry = target;
    this.#module = modulePath;
    this.#name = name;
    this.#source = source;

    this.registerActions = this.registerActions.bind(this);
  }

  registerActions(actions: GrantDefs): this {
    registry.registerGrant(this.#registry, this.#module, this.#name, this.#source, actions);

    return this;
  }
}
