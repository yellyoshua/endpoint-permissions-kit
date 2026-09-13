export type RecordValue = string | number | boolean;

export type RecordData = Readonly<Record<string, RecordValue>>;

export function fieldsOf(records: readonly RecordData[]): readonly string[] {
  const fields = new Set<string>();
  for (const record of records) {
    for (const field of Object.keys(record)) fields.add(field);
  }
  return [...fields];
}

export function editableFields(record: RecordData): readonly string[] {
  return Object.keys(record).filter((field) => field !== 'id');
}
