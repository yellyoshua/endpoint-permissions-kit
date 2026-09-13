import ResourceScreen from './ResourceScreen';

export default function EmployeesScreen() {
  return <ResourceScreen title="Employees" subject="employee" action="large.hr.employees" name="all" listPath="/hr/employees" writePath="/hr/employees" />;
}
