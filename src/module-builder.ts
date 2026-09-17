import type { Registry } from './registry';
import type { HookFn, Method } from './types';
import NameBuilder from './name-builder';
import identifiers from './identifiers';
import registry from './registry';

export default class ModuleBuilder<R extends string> {
  readonly #registry: Registry;

  readonly #path: readonly string[];

  readonly #modules: Map<string, ModuleBuilder<R>>;

  readonly #names: Map<string, NameBuilder<R>>;

  constructor(target: Registry, path: readonly string[]) {
    identifiers.checkSegment(path[path.length - 1]);

    this.#registry = target;
    this.#path = Object.freeze([...path]);
    this.#modules = new Map();
    this.#names = new Map();

    this.module = this.module.bind(this);
    this.name = this.name.bind(this);
    this.hook = this.hook.bind(this);
  }

  module(segment: string): ModuleBuilder<R> {
    const existing = this.#modules.get(segment);

    if (existing !== undefined) return existing;

    const created = new ModuleBuilder<R>(this.#registry, [...this.#path, segment]);

    this.#modules.set(segment, created);

    return created;
  }

  name(name: string): NameBuilder<R> {
    const existing = this.#names.get(name);

    if (existing !== undefined) return existing;

    const created = new NameBuilder<R>(this.#registry, identifiers.joinModule(this.#path), name);

    this.#names.set(name, created);

    return created;
  }

  hook(method: Method, fn: HookFn): this {
    registry.registerModuleHook(this.#registry, identifiers.joinModule(this.#path), method, fn);

    return this;
  }
}
