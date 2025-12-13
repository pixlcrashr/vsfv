import { RequestHandler } from '@builder.io/qwik-city';
import { checkPermission } from './rbac';

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

export function requirePermission(resource: string, action: string): RequestHandler {
  return async ({ sharedMap, redirect, status }) => {
    const userId = sharedMap.get('userId') as string | undefined;
    
    if (!userId) {
      throw redirect(302, '/login');
    }
    
    const hasPermission = await checkPermission(userId, resource, action);
    
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
