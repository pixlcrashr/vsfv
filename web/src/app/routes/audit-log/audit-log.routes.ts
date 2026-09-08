import { Routes } from '@angular/router';
import { AuditLogDataService } from './audit-log.data-service';
import { AuditLogQueryService } from './audit-log.query-service';
import { environment } from '../../../environments/environment';
import { requireAllPermissions } from '../../../lib/authz/permission.guard';
import { Permissions } from '../../../lib/authz/permissions';
import { resolvePermissions } from '../../../lib/authz/permission.resolver';

/**
 * Audit log routes mounted under the organization prefix
 * (organizations/:orgId/auditLog). The component derives its scope from the
 * :orgId route parameter; a separate global view is registered under /admin.
 */
export const AUDIT_LOG_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requireAllPermissions(Permissions.AUDIT_LOGS_READ)],
    resolve: {
      permissions: resolvePermissions(Permissions.AUDIT_LOGS_READ),
    },
    loadComponent: () =>
      import('./audit-log.component').then((m) => m.AuditLogComponent),
    providers: [
      { provide: AuditLogDataService, useClass: environment.dataServices.auditLog },
      AuditLogQueryService,
    ],
  },
];
