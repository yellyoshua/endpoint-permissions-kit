import ResourceScreen from './ResourceScreen';

export default function OrdersScreen() {
  return <ResourceScreen title="Orders" subject="order" action="large.sales.orders" name="all" listPath="/sales/orders" writePath="/sales/orders" />;
}
