import { useState } from 'react';
import ErrorNotice from '../../../client/ErrorNotice';
import Loading from '../../../client/Loading';
import RecordForm from '../../../client/RecordForm';
import RecordTable from '../../../client/RecordTable';
import { editableFields, type RecordData } from '../../../client/records';
import useApiQuery from '../../../client/useApiQuery';
import useProjectSession from '../../../client/useProjectSession';
import type { ErrorBody } from '../../../server/errors';

const PROFILE_ACTION = 'small.profile';
const PROFILE_NAME = 'all';

export default function ProfileScreen() {
  const session = useProjectSession();
  const profile = useApiQuery<RecordData>(() => session.request('/profile'), [session.userId]);
  const [lastError, setLastError] = useState<ErrorBody['error'] | undefined>(undefined);
  const canUpdate = session.can(PROFILE_ACTION, PROFILE_NAME, 'update');

  async function submitUpdate(values: RecordData) {
    const result = await session.request('/profile', 'PATCH', values);
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    profile.reload();
  }

  if (profile.state.status === 'loading') return <Loading />;
  if (profile.state.status === 'error') return <ErrorNotice code={profile.state.code} message={profile.state.message} />;
  return (
    <section>
      <h2>Profile</h2>
      {lastError !== undefined && <ErrorNotice code={lastError.code} message={lastError.message} fields={lastError.fields} reasons={lastError.reasons} />}
      <RecordTable caption="Own profile" records={[profile.state.data]} />
      {canUpdate && (
        <RecordForm key={session.userId} legend="Edit profile" fields={editableFields(profile.state.data)} initial={profile.state.data} submitLabel="Save profile" onSubmit={submitUpdate} />
      )}
    </section>
  );
}
