import EmptyNotice from '../../../client/EmptyNotice';
import ErrorNotice from '../../../client/ErrorNotice';
import Loading from '../../../client/Loading';
import RecordTable from '../../../client/RecordTable';
import type { RecordData } from '../../../client/records';
import useApiQuery from '../../../client/useApiQuery';
import useProjectSession from '../../../client/useProjectSession';

export default function PublishedNotesScreen() {
  const session = useProjectSession();
  const notes = useApiQuery<readonly RecordData[]>(() => session.request('/notes/published'), [session.userId]);
  if (notes.state.status === 'loading') return <Loading />;
  if (notes.state.status === 'error') return <ErrorNotice code={notes.state.code} message={notes.state.message} />;
  if (notes.state.data.length === 0) return <EmptyNotice subject="published notes" />;
  return (
    <section>
      <h2>Published notes</h2>
      <RecordTable caption="Published notes (read-only projection)" records={notes.state.data} />
    </section>
  );
}
