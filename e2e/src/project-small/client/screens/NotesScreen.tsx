import { useState } from 'react';
import EmptyNotice from '../../../client/EmptyNotice';
import ErrorNotice from '../../../client/ErrorNotice';
import Loading from '../../../client/Loading';
import RecordForm from '../../../client/RecordForm';
import RecordTable from '../../../client/RecordTable';
import { editableFields, fieldsOf, type RecordData } from '../../../client/records';
import useApiQuery from '../../../client/useApiQuery';
import useProjectSession from '../../../client/useProjectSession';
import type { ErrorBody } from '../../../server/errors';

const NOTES_ACTION = 'small.notes';
const NOTES_NAME = 'all';

export default function NotesScreen() {
  const session = useProjectSession();
  const notes = useApiQuery<readonly RecordData[]>(() => session.request('/notes'), [session.userId]);
  const [editing, setEditing] = useState<RecordData | undefined>(undefined);
  const [lastError, setLastError] = useState<ErrorBody['error'] | undefined>(undefined);
  const canCreate = session.can(NOTES_ACTION, NOTES_NAME, 'create');
  const canUpdate = session.can(NOTES_ACTION, NOTES_NAME, 'update');
  const canRemove = session.can(NOTES_ACTION, NOTES_NAME, 'remove');

  async function submitCreate(values: RecordData) {
    const result = await session.request('/notes', 'POST', values);
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    notes.reload();
  }

  async function submitUpdate(values: RecordData) {
    if (editing === undefined) return;
    const result = await session.request(`/notes/${String(editing.id)}`, 'PATCH', values);
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    setEditing(undefined);
    notes.reload();
  }

  async function remove(record: RecordData) {
    const result = await session.request(`/notes/${String(record.id)}`, 'DELETE');
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    notes.reload();
  }

  if (notes.state.status === 'loading') return <Loading />;
  if (notes.state.status === 'error') return <ErrorNotice code={notes.state.code} message={notes.state.message} />;
  const records = notes.state.data;
  const createFields = editableFields(Object.fromEntries(fieldsOf(records).map((field) => [field, ''])));
  return (
    <section>
      <h2>Notes</h2>
      {lastError !== undefined && <ErrorNotice code={lastError.code} message={lastError.message} fields={lastError.fields} reasons={lastError.reasons} />}
      {records.length === 0 ? (
        <EmptyNotice subject="notes" />
      ) : (
        <RecordTable
          caption="Notes visible to the current user"
          records={records}
          renderActions={(record) => (
            <>
              {canUpdate && <button type="button" onClick={() => setEditing(record)}>Edit</button>}
              {canRemove && <button type="button" onClick={() => remove(record)}>Remove</button>}
            </>
          )}
        />
      )}
      {canCreate && <RecordForm legend="Create note" fields={createFields} submitLabel="Create note" onSubmit={submitCreate} />}
      {editing !== undefined && (
        <RecordForm key={String(editing.id)} legend={`Edit note ${String(editing.id)}`} fields={editableFields(editing)} initial={editing} submitLabel="Save changes" onSubmit={submitUpdate} />
      )}
    </section>
  );
}
