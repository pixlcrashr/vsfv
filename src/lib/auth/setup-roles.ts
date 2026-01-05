import { Prisma } from '~/lib/prisma';
import { addPermission } from './rbac';
import { getEnforcer } from './enforcer';

export const SYSTEM_ROLE_ID = 'system';

export async function setupSystemRole(): Promise<void> {
  const existingRole = await Prisma.user_groups.findUnique({
    where: { id: SYSTEM_ROLE_ID },
  });

  if (!existingRole) {
    await Prisma.user_groups.create({
      data: {
        id: SYSTEM_ROLE_ID,
        name: 'System',
        description: 'System administrator role with all permissions',
        is_system: true,
      },
    });

    await addPermission(SYSTEM_ROLE_ID, '*', '*');
    
    console.log('System role created with all permissions');
  } else {
    const enforcer = await getEnforcer();
    const hasAllPermissions = await enforcer.hasPolicy(SYSTEM_ROLE_ID, '*', '*');
    
    if (!hasAllPermissions) {
      await addPermission(SYSTEM_ROLE_ID, '*', '*');
      console.log('System role permissions restored');
    }
  }
}

export async function isFirstUser(): Promise<boolean> {
  const userCount = await Prisma.users.count();
  return userCount === 0;
}

export async function assignSystemRoleToUser(userId: string): Promise<void> {
  const enforcer = await getEnforcer();
  await enforcer.addGroupingPolicy(userId, SYSTEM_ROLE_ID);
}
