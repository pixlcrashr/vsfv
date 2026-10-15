import { Routes } from '@angular/router';
import { Matrix } from './matrix.component';
import { MatrixDataService } from './matrix.data-service';
import { MatrixValuesCacheService } from './matrix-values-cache.service';
import { environment } from '../../../environments/environment';
import { requireAllPermissions } from '../../../lib/authz/permission.guard';
import { Permission, Permissions } from '../../../lib/authz/permissions';
import { resolvePermissions } from '../../../lib/authz/permission.resolver';

export const MATRIX_ROUTES: Routes = [
  {
    path: '',
    canActivate: [requireAllPermissions(Permissions.MATRIX_READ)],
    resolve: {
      permissions: resolvePermissions(Permissions.MATRIX_UPDATE),
    },
    loadComponent: () => import('./matrix.component').then((m) => m.Matrix),
    providers: [
      {
        provide: MatrixDataService,
        useClass: environment.dataServices.matrix,
      },
      {
        provide: MatrixValuesCacheService,
        useClass: MatrixValuesCacheService,
      },
      {
        provide: Matrix,
        useClass: Matrix,
      },
    ],
  }
];
