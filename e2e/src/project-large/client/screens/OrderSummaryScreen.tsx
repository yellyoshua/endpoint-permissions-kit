import ResourceScreen from './ResourceScreen';

export default function OrderSummaryScreen() {
  return <ResourceScreen title="Order summary" subject="order" action="large.sales.orders" name="summary" listPath="/sales/orders/summary" writePath="/sales/orders/summary" />;
}
