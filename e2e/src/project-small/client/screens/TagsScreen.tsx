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

const TAGS_ACTION = 'small.tags';
const TAGS_NAME = 'all';

export default function TagsScreen() {
  const session = useProjectSession();
  const tags = useApiQuery<readonly RecordData[]>(() => session.request('/tags'), [session.userId]);
  const [lastError, setLastError] = useState<ErrorBody['error'] | undefined>(undefined);
  const canCreate = session.can(TAGS_ACTION, TAGS_NAME, 'create');
  const canRemove = session.can(TAGS_ACTION, TAGS_NAME, 'remove');

  async function submitCreate(values: RecordData) {
    const result = await session.request('/tags', 'POST', values);
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    tags.reload();
  }

  async function remove(record: RecordData) {
    const result = await session.request(`/tags/${String(record.id)}`, 'DELETE');
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    tags.reload();
  }

  if (tags.state.status === 'loading') return <Loading />;
  if (tags.state.status === 'error') return <ErrorNotice code={tags.state.code} message={tags.state.message} />;
  const records = tags.state.data;
  const createFields = editableFields(Object.fromEntries(fieldsOf(records).map((field) => [field, ''])));
  return (
    <section>
      <h2>Tags</h2>
      {lastError !== undefined && <ErrorNotice code={lastError.code} message={lastError.message} fields={lastError.fields} reasons={lastError.reasons} />}
      {records.length === 0 ? (
        <EmptyNotice subject="tags" />
      ) : (
        <RecordTable
          caption="Tags"
          records={records}
          renderActions={(record) => canRemove && <button type="button" onClick={() => remove(record)}>Remove</button>}
        />
      )}
      {canCreate && <RecordForm legend="Create tag" fields={createFields} submitLabel="Create tag" onSubmit={submitCreate} />}
    </section>
  );
}
