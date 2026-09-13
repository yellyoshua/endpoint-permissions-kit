import ResourceScreen from './ResourceScreen';

export default function OrderStatusScreen() {
  return <ResourceScreen title="Order status" subject="order" action="large.sales.orders" name="update-only" listPath="/sales/orders/status" writePath="/sales/orders/status" />;
}
