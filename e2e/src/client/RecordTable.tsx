import type { ReactNode } from 'react';
import { fieldsOf, type RecordData } from './records';

interface RecordTableProps {
  readonly records: readonly RecordData[];
  readonly caption: string;
  readonly renderActions?: (record: RecordData) => ReactNode;
}

export default function RecordTable({ records, caption, renderActions }: RecordTableProps) {
  const fields = fieldsOf(records);
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {fields.map((field) => (
            <th key={field} scope="col">{field}</th>
          ))}
          {renderActions !== undefined && <th scope="col">actions</th>}
        </tr>
      </thead>
      <tbody>
        {records.map((record, index) => (
          <tr key={String(record.id ?? index)}>
            {fields.map((field) => (
              <td key={field}>{String(record[field] ?? '')}</td>
            ))}
            {renderActions !== undefined && <td>{renderActions(record)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
