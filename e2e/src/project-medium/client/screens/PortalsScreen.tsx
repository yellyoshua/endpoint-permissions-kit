import { useState } from 'react';
import EmptyNotice from '../../../client/EmptyNotice';
import ErrorNotice from '../../../client/ErrorNotice';
import Loading from '../../../client/Loading';
import RecordTable from '../../../client/RecordTable';
import type { RecordData } from '../../../client/records';
import useApiQuery from '../../../client/useApiQuery';
import useProjectSession from '../../../client/useProjectSession';
import type { ErrorBody } from '../../../server/errors';

const PORTALS_ACTION = 'medium.marketing.portals';
const PORTALS_NAME = 'all';

export default function PortalsScreen() {
  const session = useProjectSession();
  const portals = useApiQuery<readonly RecordData[]>(() => session.request('/marketing/portals'), [session.userId]);
  const [lastError, setLastError] = useState<ErrorBody['error'] | undefined>(undefined);
  const canRemove = session.can(PORTALS_ACTION, PORTALS_NAME, 'remove');

  async function remove(record: RecordData) {
    const result = await session.request(`/marketing/portals/${String(record.id)}`, 'DELETE');
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    portals.reload();
  }

  if (portals.state.status === 'loading') return <Loading />;
  if (portals.state.status === 'error') return <ErrorNotice code={portals.state.code} message={portals.state.message} />;
  if (portals.state.data.length === 0) return <EmptyNotice subject="portals" />;
  return (
    <section>
      <h2>Portals</h2>
      {lastError !== undefined && <ErrorNotice code={lastError.code} message={lastError.message} fields={lastError.fields} reasons={lastError.reasons} />}
      <RecordTable
        caption="Portals visible to the current user"
        records={portals.state.data}
        renderActions={(record) => canRemove && <button type="button" onClick={() => remove(record)}>Remove</button>}
      />
    </section>
  );
}
