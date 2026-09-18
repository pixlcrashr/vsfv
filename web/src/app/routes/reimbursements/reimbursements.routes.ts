import { Routes } from '@angular/router';
import { ReimbursementListDataService } from './reimbursement-list/reimbursement-list.data-service';
import { ReimbursementEditDataService } from './reimbursement-edit/reimbursement-edit.data-service';
import { ReimbursementNewDataService } from './reimbursement-new/reimbursement-new.data-service';
import { environment } from '../../../environments/environment';
import { requireAllPermissions, requireAnyPermission } from '../../../lib/authz/permission.guard';
import { Permission, Permissions } from '../../../lib/authz/permissions';
import { resolvePermissions } from '../../../lib/authz/permission.resolver';

export const REIMBURSEMENTS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requireAnyPermission(
      Permissions.REIMBURSEMENTS_READ,
      Permissions.REIMBURSEMENTS_READ_OWN
    )],
    resolve: {
      permissions: resolvePermissions(
        Permissions.REIMBURSEMENTS_READ,
        Permissions.REIMBURSEMENTS_READ_OWN,
        Permissions.REIMBURSEMENTS_CREATE,
        Permissions.REIMBURSEMENTS_UPDATE,
        Permissions.REIMBURSEMENTS_UPDATE_OWN,
        Permissions.REIMBURSEMENTS_COMMENT,
        Permissions.REIMBURSEMENTS_COMMENT_OWN,
        Permissions.REIMBURSEMENTS_ARCHIVE
      ),
    },
    loadComponent: () =>
      import('./reimbursement-list/reimbursement-list.component').then(
        (m) => m.ReimbursementListComponent
      ),
    providers: [
      {
        provide: ReimbursementListDataService,
        useClass: environment.dataServices.reimbursementList,
      },
    ],
  },
  {
    path: 'new',
    canActivate: [requireAllPermissions(Permissions.REIMBURSEMENTS_CREATE)],
    loadComponent: () =>
      import('./reimbursement-new/reimbursement-new.component').then(
        (m) => m.ReimbursementNewComponent
      ),
    providers: [
      {
        provide: ReimbursementNewDataService,
        useClass: environment.dataServices.reimbursementNew,
      },
    ],
  },
  {
    path: 'assistant',
    canActivate: [requireAllPermissions(Permissions.REIMBURSEMENTS_CREATE)],
    loadComponent: () =>
      import('./reimbursement-assistant/reimbursement-assistant.component').then(
        (m) => m.ReimbursementAssistantComponent
      ),
    providers: [
      {
        provide: ReimbursementNewDataService,
        useClass: environment.dataServices.reimbursementNew,
      },
    ],
  },
  {
    path: ':id',
    canActivate: [requireAnyPermission(
      Permissions.REIMBURSEMENTS_READ,
      Permissions.REIMBURSEMENTS_READ_OWN
    )],
    resolve: {
      permissions: resolvePermissions(
        Permissions.REIMBURSEMENTS_READ,
        Permissions.REIMBURSEMENTS_READ_OWN,
        Permissions.REIMBURSEMENTS_CREATE,
        Permissions.REIMBURSEMENTS_UPDATE,
        Permissions.REIMBURSEMENTS_UPDATE_OWN,
        Permissions.REIMBURSEMENTS_COMMENT,
        Permissions.REIMBURSEMENTS_COMMENT_OWN,
        Permissions.REIMBURSEMENTS_ARCHIVE
      ),
    },
    loadComponent: () =>
      import('./reimbursement-edit/reimbursement-edit.component').then(
        (m) => m.ReimbursementEditComponent
      ),
    providers: [
      {
        provide: ReimbursementEditDataService,
        useClass: environment.dataServices.reimbursementEdit,
      },
    ],
  },
];
