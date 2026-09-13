import { useState } from 'react';
import EmptyNotice from '../../client/EmptyNotice';
import ErrorNotice from '../../client/ErrorNotice';
import Loading from '../../client/Loading';
import RecordForm from '../../client/RecordForm';
import RecordTable from '../../client/RecordTable';
import { editableFields, fieldsOf, type RecordData } from '../../client/records';
import useApiQuery from '../../client/useApiQuery';
import useProjectSession from '../../client/useProjectSession';
import type { ErrorBody } from '../../server/errors';

interface CollectionScreenProps {
  readonly title: string;
  readonly subject: string;
  readonly path: string;
  readonly action: string;
  readonly name: string;
}

export default function CollectionScreen({ title, subject, path, action, name }: CollectionScreenProps) {
  const session = useProjectSession();
  const records = useApiQuery<readonly RecordData[]>(() => session.request(path), [session.userId, path]);
  const [editing, setEditing] = useState<RecordData | undefined>(undefined);
  const [lastError, setLastError] = useState<ErrorBody['error'] | undefined>(undefined);
  const canCreate = session.can(action, name, 'create');
  const canUpdate = session.can(action, name, 'update');
  const canRemove = session.can(action, name, 'remove');

  async function submitCreate(values: RecordData) {
    const result = await session.request(path, 'POST', values);
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    records.reload();
  }

  async function submitUpdate(values: RecordData) {
    if (editing === undefined) return;
    const result = await session.request(`${path}/${String(editing.id)}`, 'PATCH', values);
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    setEditing(undefined);
    records.reload();
  }

  async function remove(record: RecordData) {
    const result = await session.request(`${path}/${String(record.id)}`, 'DELETE');
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    records.reload();
  }

  if (records.state.status === 'loading') return <Loading />;
  if (records.state.status === 'error') return <ErrorNotice code={records.state.code} message={records.state.message} />;
  const data = records.state.data;
  const hasRowActions = canUpdate || canRemove;
  const createFields = editableFields(Object.fromEntries(fieldsOf(data).map((field) => [field, ''])));
  return (
    <section>
      <h2>{title}</h2>
      {lastError !== undefined && <ErrorNotice code={lastError.code} message={lastError.message} fields={lastError.fields} reasons={lastError.reasons} />}
      {data.length === 0 ? (
        <EmptyNotice subject={subject} />
      ) : (
        <RecordTable
          caption={`${title} visible to the current user`}
          records={data}
          renderActions={hasRowActions ? (record) => (
            <>
              {canUpdate && <button type="button" onClick={() => setEditing(record)}>Edit</button>}
              {canRemove && <button type="button" onClick={() => remove(record)}>Remove</button>}
            </>
          ) : undefined}
        />
      )}
      {canCreate && <RecordForm legend={`Create ${subject}`} fields={createFields} submitLabel={`Create ${subject}`} onSubmit={submitCreate} />}
      {editing !== undefined && (
        <RecordForm key={String(editing.id)} legend={`Edit ${subject} ${String(editing.id)}`} fields={editableFields(editing)} initial={editing} submitLabel="Save changes" onSubmit={submitUpdate} />
      )}
    </section>
  );
}
