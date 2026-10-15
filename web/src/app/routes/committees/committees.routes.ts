import { Routes } from '@angular/router';
import { CommitteeListDataService } from './committee-list/committee-list.data-service';
import { CommitteeNewDataService } from './committee-new/committee-new.data-service';
import { CommitteeEditDataService } from './committee-edit/committee-edit.data-service';
import { environment } from '../../../environments/environment';
import { requireAllPermissions, requireAnyPermission } from '../../../lib/authz/permission.guard';
import { Permissions } from '../../../lib/authz/permissions';
import { resolvePermissions } from '../../../lib/authz/permission.resolver';

export const COMMITTEES_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requireAllPermissions(Permissions.COMMITTEES_READ)],
    resolve: {
      permissions: resolvePermissions(Permissions.COMMITTEES_CREATE, Permissions.COMMITTEES_UPDATE, Permissions.COMMITTEES_DELETE),
    },
    loadComponent: () =>
      import('./committee-list/committee-list.component').then(
        (m) => m.CommitteeListComponent
      ),
    providers: [{ provide: CommitteeListDataService, useClass: environment.dataServices.committeeList }],
  },
  {
    path: 'new',
    canActivate: [requireAllPermissions(Permissions.COMMITTEES_CREATE)],
    loadComponent: () =>
      import('./committee-new/committee-new.component').then(
        (m) => m.CommitteeNewComponent
      ),
    providers: [{ provide: CommitteeNewDataService, useClass: environment.dataServices.committeeNew }],
  },
  {
    path: ':id/edit',
    canActivate: [requireAnyPermission(Permissions.COMMITTEES_READ, Permissions.COMMITTEES_UPDATE)],
    resolve: {
      permissions: resolvePermissions(Permissions.COMMITTEES_UPDATE, Permissions.COMMITTEES_DELETE),
    },
    loadComponent: () =>
      import('./committee-edit/committee-edit.component').then(
        (m) => m.CommitteeEditComponent
      ),
    providers: [{ provide: CommitteeEditDataService, useClass: environment.dataServices.committeeEdit }],
  },
];
