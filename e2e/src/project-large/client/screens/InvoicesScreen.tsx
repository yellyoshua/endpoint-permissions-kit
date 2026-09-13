import ResourceScreen from './ResourceScreen';

export default function InvoicesScreen() {
  return <ResourceScreen title="Invoices" subject="invoice" action="large.billing.invoices" name="all" listPath="/billing/invoices" writePath="/billing/invoices" />;
}
