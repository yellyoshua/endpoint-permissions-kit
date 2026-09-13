import CollectionScreen from '../CollectionScreen';

export default function EntriesSummaryScreen() {
  return <CollectionScreen title="Ledger summary" subject="entry" path="/finance/ledger/entries/summary" action="xl.finance.ledger.entries" name="summary" />;
}
