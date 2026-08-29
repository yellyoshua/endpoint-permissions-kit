import type { PermissionRole, PermissionRule, PermissionOptions } from '../types/index.js';

export class PermissionManager {
  private rules: PermissionRule[] = [];
  private options: PermissionOptions;

  constructor(options: PermissionOptions = {}) {
    this.options = {
      strict: false,
      defaultAllow: false,
      ...options,
    };
  }

  public addRule(rule: PermissionRule): this {
    this.rules.push(rule);
    return this;
  }

  public can(role: PermissionRole, action: string, resource: string, context?: Record<string, unknown>): boolean {
    const matchingRule = this.rules.find((r) => {
      const roleMatch = !r.role || r.role === role;
      const actionMatch = r.action === '*' || r.action === action;
      const resourceMatch = r.resource === '*' || r.resource === resource;
      return roleMatch && actionMatch && resourceMatch;
    });

    if (!matchingRule) {
      return this.options.defaultAllow ?? false;
    }

    if (matchingRule.condition) {
      return matchingRule.condition(context);
    }

    return true;
  }
}
