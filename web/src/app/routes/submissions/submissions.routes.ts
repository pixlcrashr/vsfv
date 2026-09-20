import { Routes } from '@angular/router';
import { SubmissionListDataService } from './submission-list/submission-list.data-service';
import { SubmissionEditDataService } from './submission-edit/submission-edit.data-service';
import { SubmissionNewDataService } from './submission-new/submission-new.data-service';
import { environment } from '../../../environments/environment';
import { requireAllPermissions, requireAnyPermission } from '../../../lib/authz/permission.guard';
import { Permission, Permissions } from '../../../lib/authz/permissions';
import { resolvePermissions } from '../../../lib/authz/permission.resolver';

export const SUBMISSIONS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requireAnyPermission(
      Permissions.SUBMISSIONS_READ,
      Permissions.SUBMISSIONS_READ_OWN
    )],
    resolve: {
      permissions: resolvePermissions(
        Permissions.SUBMISSIONS_READ,
        Permissions.SUBMISSIONS_READ_OWN,
        Permissions.SUBMISSIONS_CREATE,
        Permissions.SUBMISSIONS_UPDATE,
        Permissions.SUBMISSIONS_UPDATE_OWN,
        Permissions.SUBMISSIONS_COMMENT,
        Permissions.SUBMISSIONS_COMMENT_OWN,
        Permissions.SUBMISSIONS_ARCHIVE
      ),
    },
    loadComponent: () =>
      import('./submission-list/submission-list.component').then(
        (m) => m.SubmissionListComponent
      ),
    providers: [
      {
        provide: SubmissionListDataService,
        useClass: environment.dataServices.submissionList,
      },
    ],
  },
  {
    path: 'new',
    canActivate: [requireAllPermissions(Permissions.SUBMISSIONS_CREATE)],
    loadComponent: () =>
      import('./submission-new/submission-new.component').then(
        (m) => m.SubmissionNewComponent
      ),
    providers: [
      {
        provide: SubmissionNewDataService,
        useClass: environment.dataServices.submissionNew,
      },
    ],
  },
  {
    path: 'assistant',
    canActivate: [requireAllPermissions(Permissions.SUBMISSIONS_CREATE)],
    loadComponent: () =>
      import('./submission-assistant/submission-assistant.component').then(
        (m) => m.SubmissionAssistantComponent
      ),
    providers: [
      {
        provide: SubmissionNewDataService,
        useClass: environment.dataServices.submissionNew,
      },
    ],
  },
  {
    path: ':id',
    canActivate: [requireAnyPermission(
      Permissions.SUBMISSIONS_READ,
      Permissions.SUBMISSIONS_READ_OWN
    )],
    resolve: {
      permissions: resolvePermissions(
        Permissions.SUBMISSIONS_READ,
        Permissions.SUBMISSIONS_READ_OWN,
        Permissions.SUBMISSIONS_CREATE,
        Permissions.SUBMISSIONS_UPDATE,
        Permissions.SUBMISSIONS_UPDATE_OWN,
        Permissions.SUBMISSIONS_COMMENT,
        Permissions.SUBMISSIONS_COMMENT_OWN,
        Permissions.SUBMISSIONS_ARCHIVE
      ),
    },
    loadComponent: () =>
      import('./submission-edit/submission-edit.component').then(
        (m) => m.SubmissionEditComponent
      ),
    providers: [
      {
        provide: SubmissionEditDataService,
        useClass: environment.dataServices.submissionEdit,
      },
    ],
  },
];
