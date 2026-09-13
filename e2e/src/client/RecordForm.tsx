import { useId, useState, type FormEvent } from 'react';
import type { RecordData, RecordValue } from './records';

interface RecordFormProps {
  readonly legend: string;
  readonly fields: readonly string[];
  readonly initial?: RecordData;
  readonly submitLabel: string;
  readonly onSubmit: (values: RecordData) => void;
}

function parseValue(raw: string, previous: RecordValue | undefined): RecordValue {
  if (typeof previous === 'number') return Number(raw);
  if (typeof previous === 'boolean') return raw === 'true';
  return raw;
}

export default function RecordForm({ legend, fields, initial, submitLabel, onSubmit }: RecordFormProps) {
  const idPrefix = useId();
  const [values, setValues] = useState<Readonly<Record<string, string>>>(() => {
    const entries = fields.map((field) => [field, String(initial?.[field] ?? '')]);
    return Object.fromEntries(entries);
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = fields.map((field) => [field, parseValue(values[field] ?? '', initial?.[field])]);
    onSubmit(Object.fromEntries(parsed));
  }

  return (
    <form onSubmit={submit}>
      <fieldset>
        <legend>{legend}</legend>
        {fields.map((field) => (
          <div key={field} className="field">
            <label htmlFor={`${idPrefix}-${field}`}>{field}</label>
            <input
              id={`${idPrefix}-${field}`}
              name={field}
              type={typeof initial?.[field] === 'number' ? 'number' : 'text'}
              value={values[field] ?? ''}
              onChange={(event) => setValues({ ...values, [field]: event.target.value })}
            />
          </div>
        ))}
        <button type="submit">{submitLabel}</button>
      </fieldset>
    </form>
  );
}
