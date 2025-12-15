import { RequestHandler } from '@builder.io/qwik-city';
import { checkPermission } from './rbac';
import { Permission } from './permissions';

export interface AuthContext {
  userId?: string;
  isAuthenticated: boolean;
}

export function requireAuth(): RequestHandler {
  return async ({ sharedMap, redirect }) => {
    const userId = sharedMap.get('userId') as string | undefined;
    
    if (!userId) {
      throw redirect(302, '/login');
    }
  };
}

export function requirePermission(permission: Permission): RequestHandler {
  return async ({ sharedMap, redirect, status }) => {
    const userId = sharedMap.get('userId') as string | undefined;
    
    if (!userId) {
      throw redirect(302, '/login');
    }
    
    const hasPermission = await checkPermission(userId, permission.resource, permission.action);
    
    if (!hasPermission) {
      status(403);
      throw new Error('Forbidden: Insufficient permissions');
    }
  };
}

export function requireRole(role: string): RequestHandler {
  return async ({ sharedMap, redirect, status }) => {
    const userId = sharedMap.get('userId') as string | undefined;
    
    if (!userId) {
      throw redirect(302, '/login');
    }
    
    const { getUserRoles } = await import('./rbac');
    const userRoles = await getUserRoles(userId);
    
    if (!userRoles.includes(role)) {
      status(403);
      throw new Error('Forbidden: Required role not found');
    }
  };
}

export function withAuth(handler: RequestHandler): RequestHandler {
  return async (requestEvent) => {
    const userId = requestEvent.sharedMap.get('userId') as string | undefined;
    
    if (!userId) {
      throw requestEvent.redirect(302, '/login');
    }
    
    return handler(requestEvent);
  };
}

export async function withPermission<T>(
  sharedMap: Map<string, any>,
  fail: (status: number, data: { message: string }) => T,
  permission: { resource: string; action: string }
): Promise<{ authorized: true; userId: string } | { authorized: false; result: T }> {
  const userId = sharedMap.get('userId') as string | undefined;
  
  if (!userId) {
    return { authorized: false, result: fail(401, { message: 'Unauthorized' }) };
  }
  
  const hasPermission = await checkPermission(userId, permission.resource, permission.action);
  if (!hasPermission) {
    return { 
      authorized: false, 
      result: fail(403, { message: `Forbidden: Insufficient permissions to ${permission.action} ${permission.resource}` }) 
    };
  }
  
  return { authorized: true, userId };
}
