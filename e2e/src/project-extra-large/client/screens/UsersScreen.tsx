import { useId, useState, type FormEvent } from 'react';
import ErrorNotice from '../../../client/ErrorNotice';
import Loading from '../../../client/Loading';
import useApiQuery from '../../../client/useApiQuery';
import useProjectSession from '../../../client/useProjectSession';
import type { ProjectCatalog } from '../../../server/catalogRoute';
import type { ErrorBody } from '../../../server/errors';
import { EXTRA_LARGE_USERS } from '../users';

interface AssignmentFormProps {
  readonly catalog: ProjectCatalog;
  readonly targetUser: string;
}

function AssignmentForm({ catalog, targetUser }: AssignmentFormProps) {
  const session = useProjectSession();
  const idPrefix = useId();
  const [selected, setSelected] = useState<ReadonlySet<string> | undefined>(undefined);
  const [lastError, setLastError] = useState<ErrorBody['error'] | undefined>(undefined);
  const [savedPermissions, setSavedPermissions] = useState<readonly string[] | undefined>(undefined);

  function toggle(permissionId: string, isChecked: boolean) {
    const next = new Set(selected ?? []);
    if (isChecked) next.add(permissionId);
    if (!isChecked) next.delete(permissionId);
    setSelected(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const permissions = [...(selected ?? [])];
    const result = await session.request<{ permissions: readonly string[] }>(`/users/${targetUser}/permissions`, 'PUT', { permissions });
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    setSavedPermissions(result.data.permissions);
  }

  const catalogIds = Object.keys(catalog).sort();
  return (
    <form onSubmit={submit}>
      <fieldset>
        <legend>Assignable identifiers for {targetUser}</legend>
        {catalogIds.map((permissionId) => (
          <div key={permissionId} className="field">
            <input
              id={`${idPrefix}-${permissionId}`}
              name="permissions"
              type="checkbox"
              value={permissionId}
              checked={selected?.has(permissionId) ?? false}
              onChange={(event) => toggle(permissionId, event.target.checked)}
            />
            <label htmlFor={`${idPrefix}-${permissionId}`}>{permissionId}</label>
          </div>
        ))}
        <button type="submit">Save permissions</button>
      </fieldset>
      {lastError !== undefined && <ErrorNotice code={lastError.code} message={lastError.message} fields={lastError.fields} reasons={lastError.reasons} />}
      {savedPermissions !== undefined && (
        <p role="status">
          Saved {savedPermissions.length} identifier{savedPermissions.length === 1 ? '' : 's'} for {targetUser}.
        </p>
      )}
    </form>
  );
}

export default function UsersScreen() {
  const session = useProjectSession();
  const selectId = useId();
  const catalog = useApiQuery<ProjectCatalog>(() => session.request('/catalog'), [session.userId]);
  const [targetUser, setTargetUser] = useState<string>(EXTRA_LARGE_USERS[0] ?? '');

  if (catalog.state.status === 'loading') return <Loading />;
  if (catalog.state.status === 'error') return <ErrorNotice code={catalog.state.code} message={catalog.state.message} />;
  return (
    <section>
      <h2>User permissions</h2>
      <div className="field">
        <label htmlFor={selectId}>Target user</label>
        <select id={selectId} name="targetUser" value={targetUser} onChange={(event) => setTargetUser(event.target.value)}>
          {EXTRA_LARGE_USERS.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>
      <AssignmentForm key={targetUser} catalog={catalog.state.data} targetUser={targetUser} />
    </section>
  );
}
