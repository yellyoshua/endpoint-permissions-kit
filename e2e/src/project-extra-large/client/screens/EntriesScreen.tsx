import CollectionScreen from '../CollectionScreen';

export default function EntriesScreen() {
  return <CollectionScreen title="Ledger entries" subject="entry" path="/finance/ledger/entries" action="xl.finance.ledger.entries" name="all" />;
}
