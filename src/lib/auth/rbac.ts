import { getEnforcer } from './enforcer';

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
