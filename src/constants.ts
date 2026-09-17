const constants = {
  METHODS: Object.freeze(['find', 'update', 'create', 'remove'] as const),

  GENERAL_ROLE: 'general',

  GLOBAL_HOOK_MARKER: '*',

  ALL_FIELDS: '*',

  MODULE_SEPARATOR: '.',

  PERMISSION_ID_SEPARATOR: '::',

  MAX_DEPTH: 1000,
} as const;

export default constants;
