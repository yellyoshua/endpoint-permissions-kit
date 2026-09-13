import CollectionScreen from '../CollectionScreen';

export default function MembersScreen() {
  return <CollectionScreen title="Tenant members" subject="member" path="/platform/tenants/members" action="xl.platform.tenants.members" name="all" />;
}
