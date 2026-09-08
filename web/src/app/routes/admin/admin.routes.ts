import { Routes } from '@angular/router';
import { UserListDataService } from './users/user-list.data-service';
import { UserEditDataService } from './users/user-edit.data-service';
import { GroupListDataService } from './groups/group-list.data-service';
import { GroupNewDataService } from './groups/group-new.data-service';
import { GroupEditDataService } from './groups/group-edit.data-service';
import { OrganizationListDataService } from './organizations/organization-list.data-service';
import { OrganizationEditDataService } from './organizations/organization-edit.data-service';
import { AuditLogDataService } from '../audit-log/audit-log.data-service';
import { AuditLogQueryService } from '../audit-log/audit-log.query-service';
import { environment } from '../../../environments/environment';
import { requireAllGlobalPermissions, requireAnyGlobalPermission } from '../../../lib/authz/permission.guard';
import { Permission, Permissions } from '../../../lib/authz/permissions';
import { resolveGlobalPermissions } from '../../../lib/authz/permission.resolver';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'organizations',
      },
      {
        path: 'users',
        canActivate: [requireAllGlobalPermissions(Permissions.USERS_READ)],
        resolve: {
          permissions: resolveGlobalPermissions(Permissions.USERS_UPDATE),
        },
        loadComponent: () => import('./users/user-list.component').then((m) => m.UserListComponent),
        providers: [
          { provide: UserListDataService, useClass: environment.dataServices.userList },
        ],
      },
      {
        path: 'users/:id/edit',
        canActivate: [requireAnyGlobalPermission(Permissions.USERS_READ, Permissions.USERS_UPDATE)],
        resolve: {
          permissions: resolveGlobalPermissions(Permissions.USERS_UPDATE),
        },
        loadComponent: () => import('./users/user-edit.component').then((m) => m.UserEditComponent),
        providers: [
          { provide: UserEditDataService, useClass: environment.dataServices.userEdit },
        ],
      },
      {
        path: 'groups',
        canActivate: [requireAllGlobalPermissions(Permissions.GROUPS_READ)],
        resolve: {
          permissions: resolveGlobalPermissions(Permissions.GROUPS_CREATE, Permissions.GROUPS_UPDATE, Permissions.GROUPS_DELETE),
        },
        loadComponent: () => import('./groups/group-list.component').then((m) => m.GroupListComponent),
        providers: [
          { provide: GroupListDataService, useClass: environment.dataServices.groupList },
        ],
      },
      {
        path: 'groups/new',
        canActivate: [requireAllGlobalPermissions(Permissions.GROUPS_CREATE)],
        loadComponent: () => import('./groups/group-new.component').then((m) => m.GroupNewComponent),
        providers: [
          { provide: GroupNewDataService, useClass: environment.dataServices.groupNew },
          { provide: OrganizationListDataService, useClass: environment.dataServices.organizationList },
        ],
      },
      {
        path: 'groups/:id/edit',
        canActivate: [requireAnyGlobalPermission(Permissions.GROUPS_READ, Permissions.GROUPS_UPDATE)],
        resolve: {
          permissions: resolveGlobalPermissions(Permissions.GROUPS_UPDATE, Permissions.GROUPS_DELETE),
        },
        loadComponent: () => import('./groups/group-edit.component').then((m) => m.GroupEditComponent),
        providers: [
          { provide: GroupEditDataService, useClass: environment.dataServices.groupEdit },
          { provide: OrganizationListDataService, useClass: environment.dataServices.organizationList },
        ],
      },
      {
        path: 'organizations',
        canActivate: [requireAllGlobalPermissions(Permissions.ORGANIZATIONS_READ)],
        resolve: {
          permissions: resolveGlobalPermissions(Permissions.ORGANIZATIONS_CREATE, Permissions.ORGANIZATIONS_UPDATE, Permissions.ORGANIZATIONS_ARCHIVE, Permissions.ORGANIZATIONS_DELETE),
        },
        loadComponent: () =>
          import('./organizations/organization-list.component').then(
            (m) => m.OrganizationListComponent
          ),
        providers: [
          { provide: OrganizationListDataService, useClass: environment.dataServices.organizationList },
        ],
      },
      {
        path: 'organizations/:id/edit',
        canActivate: [requireAnyGlobalPermission(Permissions.ORGANIZATIONS_READ, Permissions.ORGANIZATIONS_UPDATE)],
        resolve: {
          permissions: resolveGlobalPermissions(Permissions.ORGANIZATIONS_UPDATE, Permissions.ORGANIZATIONS_ARCHIVE, Permissions.ORGANIZATIONS_DELETE),
        },
        loadComponent: () =>
          import('./organizations/organization-edit.component').then(
            (m) => m.OrganizationEditComponent
          ),
        providers: [
          { provide: OrganizationEditDataService, useClass: environment.dataServices.organizationEdit },
        ],
      },
      {
        path: 'auditLog',
        canActivate: [requireAllGlobalPermissions(Permissions.AUDIT_LOGS_READ)],
        resolve: {
          permissions: resolveGlobalPermissions(Permissions.AUDIT_LOGS_READ),
        },
        loadComponent: () =>
          import('../audit-log/audit-log.component').then((m) => m.AuditLogComponent),
        providers: [
          { provide: AuditLogDataService, useClass: environment.dataServices.auditLog },
          AuditLogQueryService,
          { provide: OrganizationListDataService, useClass: environment.dataServices.organizationList },
        ],
      },
    ],
  },
];
