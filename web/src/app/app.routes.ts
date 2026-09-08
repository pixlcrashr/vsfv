import { Routes } from '@angular/router';
import { MainLayoutDataService } from './shared/layout/main-layout/main-layout.data-service';
import { ReportTemplateEditDataService } from './routes/report-templates/report-template-edit/report-template-edit.data-service';
import { UserProfileDataService } from './routes/profile/user-profile.data-service';
import { environment } from '../environments/environment';
import { authGuard } from './auth/auth.guard';
import { organizationRedirectGuard } from './auth/organization-redirect.guard';



export const routes: Routes = [
  // Standalone preview route (no main layout, full-page)
  {
    path: 'preview/report-template/:previewId',
    loadComponent: () =>
      import('./routes/report-templates/report-template-preview/report-template-preview.component').then(
        (m) => m.ReportTemplatePreviewComponent,
      ),
    providers: [
      { provide: ReportTemplateEditDataService, useClass: environment.dataServices.reportTemplateEdit },
    ],
  },
  // Login / OAuth2 callback route (no main layout, no auth guard)
  {
    path: 'login',
    loadComponent: () =>
      import('./routes/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  // Logout route (no main layout, no auth guard, no menu)
  {
    path: 'logout',
    loadComponent: () =>
      import('./routes/logout/logout.component').then(
        (m) => m.LogoutComponent,
      ),
  },
  // Main layout with left sidebar - single instance for all routes
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent,
      ),
    providers: [
      { provide: MainLayoutDataService, useClass: environment.dataServices.mainLayout },
    ],
    children: [
      // Permission denied (global, no org prefix)
      {
        path: 'permission-denied',
        loadComponent: () =>
          import('./routes/permission-denied/permission-denied.component').then(
            (m) => m.PermissionDeniedComponent,
          ),
      },
      // User profile (self-service settings)
      {
        path: 'me',
        loadComponent: () =>
          import('./routes/profile/user-profile.component').then(
            (m) => m.UserProfileComponent,
          ),
        providers: [
          { provide: UserProfileDataService, useClass: environment.dataServices.userProfile },
        ],
      },
      // Admin routes
      {
        path: 'admin',
        loadChildren: () => import('./routes/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
      },
      // Organization-prefixed routes with full path
      {
        path: 'organizations/:orgId',
        redirectTo: 'organizations/:orgId/dashboard',
        pathMatch: 'full',
      },
      {
        path: 'organizations/:orgId/dashboard',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () =>
          import('./routes/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'organizations/:orgId/reimbursements',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () =>
          import('./routes/reimbursements/reimbursements.routes').then(
            (m) => m.REIMBURSEMENTS_ROUTES,
          ),
      },
      {
        path: 'organizations/:orgId/budgets',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () => import('./routes/budgets/budgets.routes').then((m) => m.BUDGETS_ROUTES),
      },
      {
        path: 'organizations/:orgId/accounts',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () =>
          import('./routes/accounts/accounts.routes').then((m) => m.ACCOUNTS_ROUTES),
      },
      {
        path: 'organizations/:orgId/accountGroups',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () =>
          import('./routes/account-groups/account-groups.routes').then(
            (m) => m.ACCOUNT_GROUPS_ROUTES,
          ),
      },
      {
        path: 'organizations/:orgId/journal',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () => import('./routes/journal/journal.routes').then((m) => m.JOURNAL_ROUTES),
      },
      {
        path: 'organizations/:orgId/transactions',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () =>
          import('./routes/transactions/transactions.routes').then((m) => m.TRANSACTIONS_ROUTES),
      },
      {
        path: 'organizations/:orgId/reports',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () => import('./routes/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'organizations/:orgId/reportTemplates',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () =>
          import('./routes/report-templates/report-templates.routes').then(
            (m) => m.REPORT_TEMPLATES_ROUTES,
          ),
      },
      {
        path: 'organizations/:orgId/matrix',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () => import('./routes/matrix/matrix.routes').then((m) => m.MATRIX_ROUTES),
      },
      // Ledger routes
      {
        path: 'organizations/:orgId/ledgerAccounts',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () => import('./routes/ledger/ledger-accounts.routes').then((m) => m.LEDGER_ACCOUNT_ROUTES),
      },
      {
        path: 'organizations/:orgId/ledgerYears',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () => import('./routes/ledger/ledger-years.routes').then((m) => m.LEDGER_YEAR_ROUTES),
      },
      // Organization settings
      {
        path: 'organizations/:orgId/settings',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () => import('./routes/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      // Organization audit log
      {
        path: 'organizations/:orgId/auditLog',
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadChildren: () => import('./routes/audit-log/audit-log.routes').then((m) => m.AUDIT_LOG_ROUTES),
      },
      // Permission denied (org-scoped)
      {
        path: 'organizations/:orgId/permission-denied',
        loadComponent: () =>
          import('./routes/permission-denied/permission-denied.component').then(
            (m) => m.PermissionDeniedComponent,
          ),
      },
      // Redirect the empty (root) route to the most recent organization
      {
        path: '',
        pathMatch: 'full',
        canActivate: [organizationRedirectGuard],
        children: [],
      },
    ],
  },
];
