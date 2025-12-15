import { checkPermission } from "./rbac";
import type { Permission } from "./permissions";

/**
 * Helper function to check multiple permissions for a user.
 * Returns an object with boolean flags for each permission.
 * 
 * @example
 * ```ts
 * export const useReportPermissions = routeLoader$(async ({ sharedMap }) => {
 *   const userId = sharedMap.get('userId') as string | undefined;
 *   return await checkPermissions(userId, {
 *     canCreate: Permissions.REPORTS_CREATE,
 *     canDelete: Permissions.REPORTS_DELETE
 *   });
 * });
 * ```
 */
export async function checkPermissions<T extends Record<string, Permission>>(
  userId: string | undefined,
  permissionMap: T
): Promise<{ [K in keyof T]: boolean }> {
  type PermissionResult = {
    [K in keyof T]: boolean;
  };

  if (!userId) {
    // Return all permissions as false if no user
    return Object.keys(permissionMap).reduce((acc, key) => {
      acc[key as keyof T] = false;
      return acc;
    }, {} as PermissionResult);
  }

  // Check all permissions in parallel
  const permissionChecks = await Promise.all(
    Object.entries(permissionMap).map(async ([key, permission]) => {
      const hasPermission = await checkPermission(
        userId,
        permission.resource,
        permission.action
      );
      return [key, hasPermission] as const;
    })
  );

  // Convert array of [key, value] pairs back to object
  return permissionChecks.reduce((acc, [key, value]) => {
    acc[key as keyof T] = value;
    return acc;
  }, {} as PermissionResult);
}
