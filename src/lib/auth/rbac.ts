import { getEnforcer } from './enforcer';
import { Permission } from './permissions';

export async function assignRole(userId: string, role: string): Promise<void> {
  const enforcer = await getEnforcer();
  await enforcer.addGroupingPolicy(userId, role);
}

export async function removeRole(userId: string, role: string): Promise<void> {
  const enforcer = await getEnforcer();
  await enforcer.removeGroupingPolicy(userId, role);
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const enforcer = await getEnforcer();
  return await enforcer.getRolesForUser(userId);
}

export async function hasRole(userId: string, role: string): Promise<boolean> {
  const enforcer = await getEnforcer();
  return await enforcer.hasGroupingPolicy(userId, role);
}

export async function checkPermission(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const enforcer = await getEnforcer();
  return await enforcer.enforce(userId, resource, action);
}

export async function hasPermission(
  userId: string,
  permission: Permission
): Promise<boolean> {
  const enforcer = await getEnforcer();

  return await enforcer.enforce(userId, permission.resource, permission.action);
}

export async function addPermission(
  role: string,
  resource: string,
  action: string
): Promise<void> {
  const enforcer = await getEnforcer();
  await enforcer.addPolicy(role, resource, action);
}

export async function removePermission(
  role: string,
  resource: string,
  action: string
): Promise<void> {
  const enforcer = await getEnforcer();
  await enforcer.removePolicy(role, resource, action);
}

export async function deletePermission(
  role: string,
  resource: string,
  action: string
): Promise<boolean> {
  const enforcer = await getEnforcer();
  return await enforcer.removePolicy(role, resource, action);
}

export async function addRoleForUser(
  userId: string,
  role: string
): Promise<boolean> {
  const enforcer = await getEnforcer();
  return await enforcer.addRoleForUser(userId, role);
}

export async function deleteRoleForUser(
  userId: string,
  role: string
): Promise<boolean> {
  const enforcer = await getEnforcer();
  return await enforcer.deleteRoleForUser(userId, role);
}

export async function getUserPermissions(userId: string): Promise<Array<{ resource: string; action: string }>> {
  const enforcer = await getEnforcer();
  const roles = await getUserRoles(userId);
  
  const permissions: Array<{ resource: string; action: string }> = [];
  
  for (const role of roles) {
    const rolePermissions = await enforcer.getPermissionsForUser(role);
    for (const [, resource, action] of rolePermissions) {
      permissions.push({ resource, action });
    }
  }
  
  return permissions;
}

export async function deleteAllPermissionsForRole(role: string): Promise<boolean> {
  const enforcer = await getEnforcer();
  return await enforcer.deletePermissionsForUser(role);
}

export async function deleteAllRolesForRole(role: string): Promise<boolean> {
  const enforcer = await getEnforcer();
  return await enforcer.deleteRolesForUser(role);
}

export async function getUsersForRole(role: string): Promise<string[]> {
  const enforcer = await getEnforcer();
  return await enforcer.getUsersForRole(role);
}
