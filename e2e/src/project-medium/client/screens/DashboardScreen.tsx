import EmptyNotice from '../../../client/EmptyNotice';
import ErrorNotice from '../../../client/ErrorNotice';
import Loading from '../../../client/Loading';
import RecordTable from '../../../client/RecordTable';
import type { RecordData } from '../../../client/records';
import useApiQuery from '../../../client/useApiQuery';
import useProjectSession from '../../../client/useProjectSession';

export default function DashboardScreen() {
  const session = useProjectSession();
  const widgets = useApiQuery<readonly RecordData[]>(() => session.request('/marketing/dashboard'), [session.userId]);
  const portals = useApiQuery<readonly RecordData[]>(() => session.request('/marketing/portals'), [session.userId]);
  if (widgets.state.status === 'loading' || portals.state.status === 'loading') return <Loading />;
  if (widgets.state.status === 'error') return <ErrorNotice code={widgets.state.code} message={widgets.state.message} />;
  return (
    <section>
      <h2>Dashboard</h2>
      {widgets.state.data.length === 0 ? <EmptyNotice subject="widgets" /> : <RecordTable caption="Traffic widgets" records={widgets.state.data} />}
      <h3>Portals reachable from the dashboard</h3>
      <p>The columns are exactly the fields the server projected for this user.</p>
      {portals.state.status === 'error' && <ErrorNotice code={portals.state.code} message={portals.state.message} />}
      {portals.state.status === 'ready' && portals.state.data.length === 0 && <EmptyNotice subject="portals" />}
      {portals.state.status === 'ready' && portals.state.data.length > 0 && <RecordTable caption="Portals as projected by the server" records={portals.state.data} />}
    </section>
  );
}
