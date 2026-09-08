export type Permission = string;

export const Permissions = {
  DASHBOARD_READ: 'dashboard:read',

  ACCOUNTS_READ: 'accounts:read',
  ACCOUNTS_CREATE: 'accounts:create',
  ACCOUNTS_UPDATE: 'accounts:update',
  ACCOUNTS_DELETE: 'accounts:delete',
  ACCOUNTS_ARCHIVE: 'accounts:archive',

  ACCOUNT_GROUPS_READ: 'accountGroups:read',
  ACCOUNT_GROUPS_CREATE: 'accountGroups:create',
  ACCOUNT_GROUPS_UPDATE: 'accountGroups:update',
  ACCOUNT_GROUPS_DELETE: 'accountGroups:delete',

  BUDGETS_READ: 'budgets:read',
  BUDGETS_CREATE: 'budgets:create',
  BUDGETS_UPDATE: 'budgets:update',
  BUDGETS_DELETE: 'budgets:delete',
  BUDGETS_CLOSE: 'budgets:close',

  JOURNAL_READ: 'journal:read',
  JOURNAL_IMPORT: 'journal:import',

  LEDGER_ACCOUNT_READ: 'ledgerAccount:read',
  LEDGER_ACCOUNT_UPDATE: 'ledgerAccount:update',
  LEDGER_ACCOUNT_DELETE: 'ledgerAccount:delete',

  LEDGER_YEAR_READ: 'ledgerYear:read',
  LEDGER_YEAR_CREATE: 'ledgerYear:create',
  LEDGER_YEAR_CLOSE: 'ledgerYear:close',
  LEDGER_YEAR_DELETE: 'ledgerYear:delete',

  TRANSACTIONS_READ: 'transactions:read',
  TRANSACTIONS_UPDATE: 'transactions:update',
  TRANSACTIONS_DELETE: 'transactions:delete',

  MATRIX_READ: 'matrix:read',
  MATRIX_UPDATE: 'matrix:update',

  REPORTS_READ: 'reports:read',
  REPORTS_CREATE: 'reports:create',
  REPORTS_DELETE: 'reports:delete',

  REPORT_TEMPLATES_READ: 'reportTemplates:read',
  REPORT_TEMPLATES_CREATE: 'reportTemplates:create',
  REPORT_TEMPLATES_UPDATE: 'reportTemplates:update',
  REPORT_TEMPLATES_DELETE: 'reportTemplates:delete',

  IMPORT_SOURCES_READ: 'importSources:read',
  IMPORT_SOURCES_CREATE: 'importSources:create',
  IMPORT_SOURCES_UPDATE: 'importSources:update',

  USERS_READ: 'users:read',
  USERS_UPDATE: 'users:update',

  GROUPS_READ: 'groups:read',
  GROUPS_CREATE: 'groups:create',
  GROUPS_UPDATE: 'groups:update',
  GROUPS_DELETE: 'groups:delete',

  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',

  ORGANIZATIONS_READ: 'organizations:read',
  ORGANIZATIONS_UPDATE: 'organizations:update',
  ORGANIZATIONS_ARCHIVE: 'organizations:archive',
  ORGANIZATIONS_CREATE: 'organizations:create',
  ORGANIZATIONS_DELETE: 'organizations:delete',

  REIMBURSEMENTS_READ: 'reimbursements:read',
  REIMBURSEMENTS_CREATE: 'reimbursements:create',
  REIMBURSEMENTS_COMMENT: 'reimbursements:comment',
  REIMBURSEMENTS_UPDATE: 'reimbursements:update',
  REIMBURSEMENTS_ARCHIVE: 'reimbursements:archive',
  REIMBURSEMENTS_READ_OWN: 'reimbursements:read_own',
  REIMBURSEMENTS_COMMENT_OWN: 'reimbursements:comment_own',
  REIMBURSEMENTS_UPDATE_OWN: 'reimbursements:update_own',

  AUDIT_LOGS_READ: 'auditLogs:read',
} as const;

export const allPermissions: Permission[] = Object.values(Permissions);
