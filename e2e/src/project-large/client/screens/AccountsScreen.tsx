import { useId, useState, type FormEvent } from 'react';
import type { Role } from 'endpoint-permissions-kit';
import ErrorNotice from '../../../client/ErrorNotice';
import Loading from '../../../client/Loading';
import useApiQuery from '../../../client/useApiQuery';
import useProjectSession from '../../../client/useProjectSession';
import type { ProjectCatalog } from '../../../server/catalogRoute';
import type { ErrorBody } from '../../../server/errors';

const ACCOUNTS_ACTION = 'large.hr.employees';
const ACCOUNTS_NAME = 'accounts';

interface Account {
  readonly id: string;
  readonly role: Role;
  readonly permissions: readonly string[];
}

interface AccountsData {
  readonly accounts: readonly Account[];
  readonly catalog: ProjectCatalog;
}

interface AccountEditorProps {
  readonly account: Account;
  readonly assignableIds: readonly string[];
  readonly canUpdate: boolean;
  readonly onSave: (account: Account, permissions: readonly string[]) => void;
}

function AccountEditor({ account, assignableIds, canUpdate, onSave }: AccountEditorProps) {
  const idPrefix = useId();
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(account.permissions));

  function toggle(permissionId: string, isChecked: boolean) {
    const next = new Set(selected);
    if (isChecked) next.add(permissionId);
    else next.delete(permissionId);
    setSelected(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(account, assignableIds.filter((permissionId) => selected.has(permissionId)));
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={!canUpdate}>
        <legend>{account.id} ({account.role})</legend>
        {assignableIds.map((permissionId) => (
          <div key={permissionId} className="field">
            <input id={`${idPrefix}-${permissionId}`} name="permissions" type="checkbox" value={permissionId} checked={selected.has(permissionId)} onChange={(event) => toggle(permissionId, event.target.checked)} />
            <label htmlFor={`${idPrefix}-${permissionId}`}>{permissionId}</label>
          </div>
        ))}
        {canUpdate && <button type="submit">Save permissions</button>}
      </fieldset>
    </form>
  );
}

export default function AccountsScreen() {
  const session = useProjectSession();
  const [lastError, setLastError] = useState<ErrorBody['error'] | undefined>(undefined);
  const canUpdate = session.can(ACCOUNTS_ACTION, ACCOUNTS_NAME, 'update');
  const data = useApiQuery<AccountsData>(async () => {
    const accounts = await session.request<readonly Account[]>('/hr/employees/accounts');
    if (!accounts.ok) return accounts;
    const catalog = await session.request<ProjectCatalog>('/catalog');
    if (!catalog.ok) return catalog;
    return { ok: true, status: catalog.status, data: { accounts: accounts.data, catalog: catalog.data } };
  }, [session.userId]);

  async function save(account: Account, permissions: readonly string[]) {
    const result = await session.request(`/users/${account.id}/permissions`, 'PUT', { permissions });
    if (!result.ok) {
      setLastError(result.error);
      return;
    }
    setLastError(undefined);
    data.reload();
  }

  if (data.state.status === 'loading') return <Loading />;
  if (data.state.status === 'error') return <ErrorNotice code={data.state.code} message={data.state.message} />;
  const catalogIds = Object.keys(data.state.data.catalog).sort();
  return (
    <section>
      <h2>Accounts and permissions</h2>
      {lastError !== undefined && <ErrorNotice code={lastError.code} message={lastError.message} fields={lastError.fields} reasons={lastError.reasons} />}
      {data.state.data.accounts.map((account) => (
        <AccountEditor
          key={`${account.id}:${account.permissions.join(',')}`}
          account={account}
          assignableIds={catalogIds.filter((permissionId) => permissionId.startsWith(`${account.role}::`))}
          canUpdate={canUpdate}
          onSave={save}
        />
      ))}
    </section>
  );
}
