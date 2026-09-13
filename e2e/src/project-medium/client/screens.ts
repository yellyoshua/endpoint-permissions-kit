import type { Screen } from '../../client/screens';
import AssetsScreen from './screens/AssetsScreen';
import DashboardScreen from './screens/DashboardScreen';
import EditableAssetsScreen from './screens/EditableAssetsScreen';
import EditablePortalsScreen from './screens/EditablePortalsScreen';
import PortalsScreen from './screens/PortalsScreen';

const SCREENS: readonly Screen[] = [
  { path: 'dashboard', title: 'Dashboard', permission: { action: 'medium.marketing.dashboard', name: 'all', methods: ['find'] }, Component: DashboardScreen },
  { path: 'portals', title: 'Portals', permission: { action: 'medium.marketing.portals', name: 'all', methods: ['find', 'remove'] }, Component: PortalsScreen },
  { path: 'portals-editable', title: 'Editable portals', permission: { action: 'medium.marketing.portals', name: 'update-only', methods: ['find', 'update'] }, Component: EditablePortalsScreen },
  { path: 'assets', title: 'Campaign assets', permission: { action: 'medium.campaigns.assets', name: 'all', methods: ['find', 'create', 'update', 'remove'] }, Component: AssetsScreen },
  { path: 'assets-editable', title: 'Editable assets', permission: { action: 'medium.campaigns.assets', name: 'update-only', methods: ['find', 'update'] }, Component: EditableAssetsScreen },
];

export default SCREENS;
