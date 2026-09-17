import type { Registry } from './registry';
import type { ContextKey, ContextValues, NamedPermissionCatalog, PkitOptions, UserAssignments, UserPermissionMap, ValidateInput, ValidateResult } from './types';
import ModuleBuilder from './module-builder';
import errors from './errors';
import permissions from './permissions';
import registry from './registry';
import snapshot from './snapshot';
import validator from './validate';

interface PkitContext<R extends string> {
  set<K extends ContextKey>(key: K, value: K extends 'roles' ? readonly R[] : ContextValues[K]): void;
  get<K extends ContextKey>(key: K): ContextValues[K];
}

interface PkitPermissions<R extends string> {
  readonly named: NamedPermissionCatalog<R>;
  forUser(assignments: UserAssignments<R>): UserPermissionMap<R>;
}

export default class Pkit<R extends string = 'general'> {
  readonly context: PkitContext<R>;

  readonly permissions: PkitPermissions<R>;

  readonly #registry: Registry;

  readonly #modules: Map<string, ModuleBuilder<R>>;

  constructor(options?: PkitOptions<R>) {
    this.#registry = registry.create(options === undefined ? {} : options);
    this.#modules = new Map();

    this.context = Object.freeze({ set: setContext.bind(this.#registry), get: getContext.bind(this.#registry) }) as PkitContext<R>;
    this.permissions = Object.freeze(Object.defineProperties({}, {
      named: { get: namedView.bind(this.#registry), enumerable: true },
      forUser: { value: forUserView.bind(this.#registry), enumerable: true },
    })) as PkitPermissions<R>;

    this.module = this.module.bind(this);
    this.validate = this.validate.bind(this);
  }

  module(segment: string): ModuleBuilder<R> {
    const existing = this.#modules.get(segment);

    if (existing !== undefined) return existing;

    const created = new ModuleBuilder<R>(this.#registry, [segment]);

    this.#modules.set(segment, created);

    return created;
  }

  validate(input: ValidateInput<R>): Promise<ValidateResult> {
    return validator.run(this.#registry, input);
  }
}

function setContext(this: Registry, key: unknown, value: unknown): void {
  if (key === 'roles') return registry.setRoles(this, value);
  if (key === 'cropper') return registry.setCropper(this, value);
  if (key === 'reservedFields') return registry.setReservedFields(this, value);

  throw errors.create('INVALID_DEFINITION', `Unknown context key: ${errors.describe(key)}`);
}

function getContext(this: Registry, key: unknown): unknown {
  if (key === 'roles') return Object.freeze([...this.roles]);
  if (key === 'cropper') return this.cropper;
  if (key === 'reservedFields') return this.reservedFields;

  throw errors.create('INVALID_DEFINITION', `Unknown context key: ${errors.describe(key)}`);
}

function namedView(this: Registry): NamedPermissionCatalog {
  return permissions.named(snapshot.of(this));
}

function forUserView(this: Registry, assignments: UserAssignments): UserPermissionMap {
  return permissions.forUser(snapshot.of(this), assignments);
}
