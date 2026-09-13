import type { Screen } from '../../client/screens';
import AccountsScreen from './screens/AccountsScreen';
import EmployeesScreen from './screens/EmployeesScreen';
import InvoicesScreen from './screens/InvoicesScreen';
import ItemsScreen from './screens/ItemsScreen';
import LinesScreen from './screens/LinesScreen';
import OrderStatusScreen from './screens/OrderStatusScreen';
import OrderSummaryScreen from './screens/OrderSummaryScreen';
import OrdersScreen from './screens/OrdersScreen';
import StockScreen from './screens/StockScreen';

const SCREENS: readonly Screen[] = [
  { path: 'items', title: 'Items', permission: { action: 'large.inventory.items', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: ItemsScreen },
  { path: 'stock', title: 'Warehouse stock', permission: { action: 'large.inventory.warehouses.stock', name: 'all', methods: ['find', 'create', 'update'] }, Component: StockScreen },
  { path: 'orders', title: 'Orders', permission: { action: 'large.sales.orders', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: OrdersScreen },
  { path: 'orders-summary', title: 'Order summary', permission: { action: 'large.sales.orders', name: 'summary', methods: ['find'] }, Component: OrderSummaryScreen },
  { path: 'orders-status', title: 'Order status', permission: { action: 'large.sales.orders', name: 'update-only', methods: ['find', 'update'] }, Component: OrderStatusScreen },
  { path: 'lines', title: 'Order lines', permission: { action: 'large.sales.orders.lines', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: LinesScreen },
  { path: 'invoices', title: 'Invoices', permission: { action: 'large.billing.invoices', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: InvoicesScreen },
  { path: 'employees', title: 'Employees', permission: { action: 'large.hr.employees', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: EmployeesScreen },
  { path: 'accounts', title: 'Accounts and permissions', permission: { action: 'large.hr.employees', name: 'accounts', methods: ['find', 'update'] }, Component: AccountsScreen },
];

export default SCREENS;
