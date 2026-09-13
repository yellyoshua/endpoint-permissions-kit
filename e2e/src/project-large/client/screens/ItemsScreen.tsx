import ResourceScreen from './ResourceScreen';

export default function ItemsScreen() {
  return <ResourceScreen title="Items" subject="item" action="large.inventory.items" name="all" listPath="/inventory/items" writePath="/inventory/items" />;
}
