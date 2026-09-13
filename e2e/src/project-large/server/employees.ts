import type { Data } from 'endpoint-permissions-kit';
import { authorizeFind, authorizeWrite, projectRecord } from '../../server/authorize';
import { deny, notFound, succeed, type UseCaseResult } from '../../server/errors';
import type { Identity } from '../../server/identity';
import { ALL_NAME, EMPLOYEES_ACTION } from './permissions';
import { deleteEmployee, findEmployee, insertEmployee, listEmployees, replaceEmployee, type Employee } from './store';

const EMPLOYEES_ALL = { action: EMPLOYEES_ACTION, name: ALL_NAME };

interface ListEmployeesRequest {
  readonly identity: Identity;
  readonly select?: readonly string[];
}

interface EmployeeWriteRequest {
  readonly identity: Identity;
  readonly data: Data;
}

interface EmployeeUpdateRequest extends EmployeeWriteRequest {
  readonly id: string;
}

interface EmployeeRemoveRequest {
  readonly identity: Identity;
  readonly id: string;
}

export async function listAllEmployees(request: ListEmployeesRequest): Promise<UseCaseResult<readonly Data[]>> {
  const authorization = await authorizeFind({ guard: EMPLOYEES_ALL, identity: request.identity, select: request.select });
  if (!authorization.isAllowed) return deny(authorization.errors);
  return succeed(listEmployees().map((employee) => projectRecord(employee, authorization.result)));
}

export async function createEmployee(request: EmployeeWriteRequest): Promise<UseCaseResult<Employee>> {
  const authorization = await authorizeWrite({ guard: EMPLOYEES_ALL, identity: request.identity, method: 'create', data: request.data });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const created = insertEmployee({
    name: String(authorization.result.name ?? ''),
    title: String(authorization.result.title ?? ''),
    salary: Number(authorization.result.salary ?? 0),
  });
  return succeed(created);
}

export async function updateEmployee(request: EmployeeUpdateRequest): Promise<UseCaseResult<Employee>> {
  const existing = findEmployee(request.id);
  if (existing === undefined) return notFound();
  const authorization = await authorizeWrite({ guard: EMPLOYEES_ALL, identity: request.identity, method: 'update', data: request.data });
  if (!authorization.isAllowed) return deny(authorization.errors);
  const updated: Employee = {
    ...existing,
    name: typeof authorization.result.name === 'string' ? authorization.result.name : existing.name,
    title: typeof authorization.result.title === 'string' ? authorization.result.title : existing.title,
    salary: typeof authorization.result.salary === 'number' ? authorization.result.salary : existing.salary,
  };
  replaceEmployee(updated);
  return succeed(updated);
}

export async function removeEmployee(request: EmployeeRemoveRequest): Promise<UseCaseResult<undefined>> {
  if (findEmployee(request.id) === undefined) return notFound();
  const authorization = await authorizeWrite({ guard: EMPLOYEES_ALL, identity: request.identity, method: 'remove', data: { id: request.id } });
  if (!authorization.isAllowed) return deny(authorization.errors);
  deleteEmployee(request.id);
  return succeed(undefined);
}
