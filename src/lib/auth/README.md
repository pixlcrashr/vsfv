# Casbin RBAC Authorization Layer

This directory contains the Casbin-based Role-Based Access Control (RBAC) implementation for the application.

## Architecture

### Files

- **`casbin-model.conf`** - Casbin RBAC model definition
- **`prisma-adapter.ts`** - Custom Prisma adapter for Casbin
- **`enforcer.ts`** - Casbin enforcer initialization and singleton
- **`permissions.ts`** - Role, resource, and action definitions + default policies
- **`rbac.ts`** - Role and permission management functions
- **`middleware.ts`** - Qwik route middleware for authorization
- **`index.ts`** - Public API exports

### RBAC Model

The system uses a simple RBAC model:
- **Roles**: `admin`, `editor`, `viewer`
- **Resources**: `accounts`, `budgets`, `transactions`, etc.
- **Actions**: `create`, `read`, `update`, `delete`, `manage`

### Default Permissions

#### Admin Role
- Full access to all resources (`manage` action)

#### Editor Role
- Read/Update: accounts, account_groups, budgets, views
- Create/Read/Update: transactions
- Read: reports, import_sources

#### Viewer Role
- Read-only access to all resources

## Usage

### In Qwik Routes

#### Protect a route with authentication

```typescript
// src/routes/accounts/layout.tsx
import { requireAuth } from '~/lib/auth';

export const onRequest = requireAuth();
```

#### Require specific permission

```typescript
// src/routes/accounts/index.tsx
import { requirePermission } from '~/lib/auth';

export const onRequest = requirePermission('accounts', 'read');
```

#### Require specific role

```typescript
// src/routes/admin/layout.tsx
import { requireRole } from '~/lib/auth';

export const onRequest = requireRole('admin');
```

#### Multiple middleware

```typescript
export const onRequest = [
  requireAuth(),
  requirePermission('budgets', 'update'),
];
```

### In Server Actions

```typescript
import { checkPermission } from '~/lib/auth';

export const updateAccount = server$(async function(accountId: string, data: any) {
  const userId = this.sharedMap.get('userId') as string;
  
  const canUpdate = await checkPermission(userId, 'accounts', 'update');
  if (!canUpdate) {
    throw new Error('Forbidden');
  }
  
  // Update account logic
});
```

### Role Management

```typescript
import { assignRole, removeRole, getUserRoles } from '~/lib/auth';

// Assign role to user (using user ID)
await assignRole('user-uuid-here', 'editor');

// Remove role
await removeRole('user-uuid-here', 'viewer');

// Get user's roles
const roles = await getUserRoles('user-uuid-here');
```

### Permission Management

```typescript
import { addPermission, removePermission } from '~/lib/auth';

// Add custom permission
await addPermission('editor', 'reports', 'delete');

// Remove permission
await removePermission('viewer', 'accounts', 'read');
```

### Check Permissions Programmatically

```typescript
import { checkPermission } from '~/lib/auth';

const canDelete = await checkPermission('user-uuid-here', 'budgets', 'delete');
if (canDelete) {
  // Allow deletion
}
```

## Performance

- **Authorization checks**: In-memory, ~0.1-1 µs per check
- **Policy loading**: Database query on startup only
- **Policy updates**: Write to both memory and database

## Multi-Instance Deployment

For load-balanced deployments with multiple instances:

1. **Use Redis Watcher** (recommended):
   ```bash
   npm install casbin-redis-watcher
   ```

2. **Or use PostgreSQL LISTEN/NOTIFY**:
   Implement a custom watcher using PostgreSQL's pub/sub

3. **Or periodic reload** (simple but with latency):
   ```typescript
   setInterval(async () => {
     await reloadPolicies();
   }, 30000); // Reload every 30 seconds
   ```

## Adding New Resources/Actions

1. Add to `permissions.ts`:
   ```typescript
   export const Resources = {
     // ...existing
     NEW_RESOURCE: 'new_resource',
   } as const;
   ```

2. Add default policies:
   ```typescript
   export const DefaultPolicies = {
     admin: [
       // ...existing
       { resource: Resources.NEW_RESOURCE, action: Actions.MANAGE },
     ],
     // ...
   };
   ```

3. Run `initializeDefaultPolicies()` to update database

## Troubleshooting

### Policies not loading
- Ensure migration has been run: `npx prisma migrate dev`
- Check `casbin_rule` table has data
- Verify `casbin-model.conf` path in `enforcer.ts`

### Permission denied unexpectedly
- Check user has correct role: `getUserRoles(userEmail)`
- Verify role has permission: `getUserPermissions(userEmail)`
- Check enforcer logs

### TypeScript errors on `casbin_rule`
- Run `npx prisma generate` after migration
- Restart TypeScript server
