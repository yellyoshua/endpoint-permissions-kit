const constants = {
  METHODS: Object.freeze(['find', 'update', 'create', 'remove'] as const),

  GENERAL_ROLE: 'general',

  GLOBAL_HOOK_OWNER: '*',

  ALL_FIELDS: '*',

  MODULE_SEPARATOR: '.',

  PERMISSION_ID_SEPARATOR: '::',
} as const;

export default constants;
