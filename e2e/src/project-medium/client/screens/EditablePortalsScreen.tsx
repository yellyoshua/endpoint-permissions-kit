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

const PORTALS_ACTION = 'medium.marketing.portals';
const PORTALS_NAME = 'update-only';

export default function EditablePortalsScreen() {
  const session = useProjectSession();
  const portals = useApiQuery<readonly RecordData[]>(() => session.request('/marketing/portals/editable'), [session.userId]);
  const [editing, setEditing] = useState<RecordData | undefined>(undefined);
  const [lastError, setLastError] = useState<ErrorBody['error'] | undefined>(undefined);
  const canUpdate = session.can(PORTALS_ACTION, PORTALS_NAME, 'update');

  async function submitUpdate(values: RecordData) {
    if (editing === undefined) return;
    const result = await session.request(`/marketing/portals/editable/${String(editing.id)}`, 'PATCH', values);
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    setEditing(undefined);
    portals.reload();
  }

  if (portals.state.status === 'loading') return <Loading />;
  if (portals.state.status === 'error') return <ErrorNotice code={portals.state.code} message={portals.state.message} />;
  if (portals.state.data.length === 0) return <EmptyNotice subject="editable portals" />;
  return (
    <section>
      <h2>Editable portals</h2>
      {lastError !== undefined && <ErrorNotice code={lastError.code} message={lastError.message} fields={lastError.fields} reasons={lastError.reasons} />}
      <RecordTable
        caption="Portals under the update-only name"
        records={portals.state.data}
        renderActions={(record) => canUpdate && <button type="button" onClick={() => setEditing(record)}>Edit</button>}
      />
      {editing !== undefined && (
        <RecordForm key={String(editing.id)} legend={`Edit portal ${String(editing.id)}`} fields={editableFields(editing)} initial={editing} submitLabel="Save changes" onSubmit={submitUpdate} />
      )}
    </section>
  );
}
