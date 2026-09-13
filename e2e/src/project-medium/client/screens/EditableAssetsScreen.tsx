import { useState } from 'react';
import EmptyNotice from '../../../client/EmptyNotice';
import ErrorNotice from '../../../client/ErrorNotice';
import Loading from '../../../client/Loading';
import RecordForm from '../../../client/RecordForm';
import RecordTable from '../../../client/RecordTable';
import { editableFields, type RecordData } from '../../../client/records';
import useApiQuery from '../../../client/useApiQuery';
import useProjectSession from '../../../client/useProjectSession';
import type { ErrorBody } from '../../../server/errors';

const ASSETS_ACTION = 'medium.campaigns.assets';
const ASSETS_NAME = 'update-only';

export default function EditableAssetsScreen() {
  const session = useProjectSession();
  const assets = useApiQuery<readonly RecordData[]>(() => session.request('/campaigns/assets/editable'), [session.userId]);
  const [editing, setEditing] = useState<RecordData | undefined>(undefined);
  const [lastError, setLastError] = useState<ErrorBody['error'] | undefined>(undefined);
  const canUpdate = session.can(ASSETS_ACTION, ASSETS_NAME, 'update');

  async function submitUpdate(values: RecordData) {
    if (editing === undefined) return;
    const result = await session.request(`/campaigns/assets/editable/${String(editing.id)}`, 'PATCH', values);
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    setEditing(undefined);
    assets.reload();
  }

  if (assets.state.status === 'loading') return <Loading />;
  if (assets.state.status === 'error') return <ErrorNotice code={assets.state.code} message={assets.state.message} />;
  if (assets.state.data.length === 0) return <EmptyNotice subject="editable assets" />;
  return (
    <section>
      <h2>Editable assets</h2>
      {lastError !== undefined && <ErrorNotice code={lastError.code} message={lastError.message} fields={lastError.fields} reasons={lastError.reasons} />}
      <RecordTable
        caption="Assets under the update-only name"
        records={assets.state.data}
        renderActions={(record) => canUpdate && <button type="button" onClick={() => setEditing(record)}>Edit</button>}
      />
      {editing !== undefined && (
        <RecordForm key={String(editing.id)} legend={`Edit asset ${String(editing.id)}`} fields={editableFields(editing)} initial={editing} submitLabel="Save changes" onSubmit={submitUpdate} />
      )}
    </section>
  );
}
