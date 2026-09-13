import ResourceScreen from './ResourceScreen';

export default function StockScreen() {
  return <ResourceScreen title="Warehouse stock" subject="stock entry" action="large.inventory.warehouses.stock" name="all" listPath="/inventory/warehouses/stock" writePath="/inventory/warehouses/stock" />;
}
