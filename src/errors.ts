import type { PkitErrorCode } from './types';

const errors = {
  create<ErrorCode extends PkitErrorCode>(code: ErrorCode, message: string): Error & { name: 'PkitError'; code: ErrorCode } {
    return Object.assign(new Error(message), { name: 'PkitError' as const, code });
  },

  /**
   * Renders an untrusted value for an error message.
   * A value with no reachable `toString`, such as `Object.create(null)`, makes
   * plain interpolation throw a `TypeError` that would escape as the wrong code.
   */
  describe(value: unknown): string {
    try {
      return String(value);
    } catch {
      return typeof value;
    }
  },
};

export default errors;
