import ResourceScreen from './ResourceScreen';

export default function LinesScreen() {
  return <ResourceScreen title="Order lines" subject="line" action="large.sales.orders.lines" name="all" listPath="/sales/orders/lines" writePath="/sales/orders/lines" />;
}
