const protocol = {
  EXIT_CODE: { success: 0, failure: 1, usage: 2 },

  CATALOG_MARKER: '__PKIT_CATALOG__',

  CHILD_TIMEOUT_MS: 30000,

  CHILD_MAX_BUFFER_BYTES: 1048576,
} as const;

export default protocol;
