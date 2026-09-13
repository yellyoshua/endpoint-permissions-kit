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

const ASSETS_ACTION = 'medium.campaigns.assets';
const ASSETS_NAME = 'all';

export default function AssetsScreen() {
  const session = useProjectSession();
  const assets = useApiQuery<readonly RecordData[]>(() => session.request('/campaigns/assets'), [session.userId]);
  const [editing, setEditing] = useState<RecordData | undefined>(undefined);
  const [lastError, setLastError] = useState<ErrorBody['error'] | undefined>(undefined);
  const canCreate = session.can(ASSETS_ACTION, ASSETS_NAME, 'create');
  const canUpdate = session.can(ASSETS_ACTION, ASSETS_NAME, 'update');
  const canRemove = session.can(ASSETS_ACTION, ASSETS_NAME, 'remove');

  async function submitCreate(values: RecordData) {
    const result = await session.request('/campaigns/assets', 'POST', values);
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    assets.reload();
  }

  async function submitUpdate(values: RecordData) {
    if (editing === undefined) return;
    const result = await session.request(`/campaigns/assets/${String(editing.id)}`, 'PATCH', values);
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    setEditing(undefined);
    assets.reload();
  }

  async function remove(record: RecordData) {
    const result = await session.request(`/campaigns/assets/${String(record.id)}`, 'DELETE');
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    assets.reload();
  }

  if (assets.state.status === 'loading') return <Loading />;
  if (assets.state.status === 'error') return <ErrorNotice code={assets.state.code} message={assets.state.message} />;
  const records = assets.state.data;
  const createFields = editableFields(Object.fromEntries(fieldsOf(records).map((field) => [field, ''])));
  return (
    <section>
      <h2>Campaign assets</h2>
      {lastError !== undefined && <ErrorNotice code={lastError.code} message={lastError.message} fields={lastError.fields} reasons={lastError.reasons} />}
      {records.length === 0 ? (
        <EmptyNotice subject="assets" />
      ) : (
        <RecordTable
          caption="Campaign assets visible to the current user"
          records={records}
          renderActions={(record) => (
            <>
              {canUpdate && <button type="button" onClick={() => setEditing(record)}>Edit</button>}
              {canRemove && <button type="button" onClick={() => remove(record)}>Remove</button>}
            </>
          )}
        />
      )}
      {canCreate && <RecordForm legend="Create asset" fields={createFields} submitLabel="Create asset" onSubmit={submitCreate} />}
      {editing !== undefined && (
        <RecordForm key={String(editing.id)} legend={`Edit asset ${String(editing.id)}`} fields={editableFields(editing)} initial={editing} submitLabel="Save changes" onSubmit={submitUpdate} />
      )}
    </section>
  );
}
