import { _ } from 'compiled-i18n';

export const Resources = {
  OVERVIEW: 'overview',
  ACCOUNTS: 'accounts',
  ACCOUNT_GROUPS: 'accountGroups',
  BUDGETS: 'budgets',
  TRANSACTIONS: 'transactions',
  JOURNAL: 'journal',
  MATRIX: 'matrix',
  REPORTS: 'reports',
  REPORT_TEMPLATES: 'reportTemplates',
  IMPORT_SOURCES: 'importSources',
  SETTINGS: 'settings',
  USERS: 'users',
  GROUPS: 'groups',
} as const;

export const Actions = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage',
  IMPORT: 'import',
} as const;

export type Resource = typeof Resources[keyof typeof Resources];
export type Action = typeof Actions[keyof typeof Actions];

export interface Permission {
  resource: Resource;
  action: Action;
  category?: string;
  name?: string;
  description?: string;
}

export const permission = (
  resource: Resource, 
  action: Action, 
  metadata?: { category: string; name: string; description: string }
): Permission => ({
  resource,
  action,
  ...metadata,
});

export const Permissions = {
  // Overview
  OVERVIEW_READ: permission(Resources.OVERVIEW, Actions.READ, {
    category: _`Übersicht`,
    name: _`Übersicht anzeigen`,
    description: _`Dashboard mit Statistiken und Übersichten ansehen`
  }),
  
  // Accounts
  ACCOUNTS_READ: permission(Resources.ACCOUNTS, Actions.READ, {
    category: _`Konten`,
    name: _`Konten anzeigen`,
    description: _`Kontenplan und Konten ansehen`
  }),
  ACCOUNTS_CREATE: permission(Resources.ACCOUNTS, Actions.CREATE, {
    category: _`Konten`,
    name: _`Konten erstellen`,
    description: _`Neue Konten anlegen`
  }),
  ACCOUNTS_UPDATE: permission(Resources.ACCOUNTS, Actions.UPDATE, {
    category: _`Konten`,
    name: _`Konten bearbeiten`,
    description: _`Bestehende Konten ändern`
  }),
  ACCOUNTS_DELETE: permission(Resources.ACCOUNTS, Actions.DELETE, {
    category: _`Konten`,
    name: _`Konten löschen`,
    description: _`Konten entfernen`
  }),
  
  // Account Groups
  ACCOUNT_GROUPS_READ: permission(Resources.ACCOUNT_GROUPS, Actions.READ, {
    category: _`Kontengruppen`,
    name: _`Kontengruppen anzeigen`,
    description: _`Kontengruppen ansehen`
  }),
  ACCOUNT_GROUPS_CREATE: permission(Resources.ACCOUNT_GROUPS, Actions.CREATE, {
    category: _`Kontengruppen`,
    name: _`Kontengruppen erstellen`,
    description: _`Neue Kontengruppen anlegen`
  }),
  ACCOUNT_GROUPS_UPDATE: permission(Resources.ACCOUNT_GROUPS, Actions.UPDATE, {
    category: _`Kontengruppen`,
    name: _`Kontengruppen bearbeiten`,
    description: _`Kontengruppen ändern`
  }),
  ACCOUNT_GROUPS_DELETE: permission(Resources.ACCOUNT_GROUPS, Actions.DELETE, {
    category: _`Kontengruppen`,
    name: _`Kontengruppen löschen`,
    description: _`Kontengruppen entfernen`
  }),
  
  // Budgets
  BUDGETS_READ: permission(Resources.BUDGETS, Actions.READ, {
    category: _`Pläne`,
    name: _`Pläne anzeigen`,
    description: _`Haushalts- und Finanzpläne ansehen`
  }),
  BUDGETS_CREATE: permission(Resources.BUDGETS, Actions.CREATE, {
    category: _`Pläne`,
    name: _`Pläne erstellen`,
    description: _`Neue Pläne anlegen`
  }),
  BUDGETS_UPDATE: permission(Resources.BUDGETS, Actions.UPDATE, {
    category: _`Pläne`,
    name: _`Pläne bearbeiten`,
    description: _`Pläne ändern`
  }),
  BUDGETS_DELETE: permission(Resources.BUDGETS, Actions.DELETE, {
    category: _`Pläne`,
    name: _`Pläne löschen`,
    description: _`Pläne entfernen`
  }),
  
  // Journal
  JOURNAL_READ: permission(Resources.JOURNAL, Actions.READ, {
    category: _`Journal`,
    name: _`Journal anzeigen`,
    description: _`Buchungen im Journal ansehen`
  }),
  JOURNAL_IMPORT: permission(Resources.JOURNAL, Actions.IMPORT, {
    category: _`Journal`,
    name: _`Transaktionen importieren`,
    description: _`Buchungen aus externen Quellen importieren`
  }),

  // Transactions
  TRANSACTIONS_READ: permission(Resources.TRANSACTIONS, Actions.READ, {
    category: _`Transaktionen`,
    name: _`Transaktionen anzeigen`,
    description: _`Transaktionen ansehen`
  }),
  TRANSACTIONS_UPDATE: permission(Resources.TRANSACTIONS, Actions.UPDATE, {
    category: _`Transaktionen`,
    name: _`Transaktionen bearbeiten`,
    description: _`Transaktionen ändern`
  }),
  TRANSACTIONS_DELETE: permission(Resources.TRANSACTIONS, Actions.DELETE, {
    category: _`Transaktionen`,
    name: _`Transaktionen löschen`,
    description: _`Transaktionen entfernen`
  }),
  
  // Matrix
  MATRIX_READ: permission(Resources.MATRIX, Actions.READ, {
    category: _`Matrix`,
    name: _`Matrix anzeigen`,
    description: _`Matrixansicht der Konten und Buchungen ansehen`
  }),
  MATRIX_UPDATE: permission(Resources.MATRIX, Actions.UPDATE, {
    category: _`Matrix`,
    name: _`Matrix bearbeiten`,
    description: _`Sollwerte in der Matrixansicht ändern`
  }),
  
  // Reports
  REPORTS_READ: permission(Resources.REPORTS, Actions.READ, {
    category: _`Berichte`,
    name: _`Berichte anzeigen`,
    description: _`Generierte Berichte ansehen`
  }),
  REPORTS_CREATE: permission(Resources.REPORTS, Actions.CREATE, {
    category: _`Berichte`,
    name: _`Berichte erstellen`,
    description: _`Neue Berichte generieren`
  }),
  REPORTS_DELETE: permission(Resources.REPORTS, Actions.DELETE, {
    category: _`Berichte`,
    name: _`Berichte löschen`,
    description: _`Berichte entfernen`
  }),
  
  // Report Templates
  REPORT_TEMPLATES_READ: permission(Resources.REPORT_TEMPLATES, Actions.READ, {
    category: _`Berichtsvorlagen`,
    name: _`Vorlagen anzeigen`,
    description: _`Berichtsvorlagen ansehen`
  }),
  REPORT_TEMPLATES_CREATE: permission(Resources.REPORT_TEMPLATES, Actions.CREATE, {
    category: _`Berichtsvorlagen`,
    name: _`Vorlagen erstellen`,
    description: _`Neue Berichtsvorlagen anlegen`
  }),
  REPORT_TEMPLATES_UPDATE: permission(Resources.REPORT_TEMPLATES, Actions.UPDATE, {
    category: _`Berichtsvorlagen`,
    name: _`Vorlagen bearbeiten`,
    description: _`Berichtsvorlagen ändern`
  }),
  REPORT_TEMPLATES_DELETE: permission(Resources.REPORT_TEMPLATES, Actions.DELETE, {
    category: _`Berichtsvorlagen`,
    name: _`Vorlagen löschen`,
    description: _`Berichtsvorlagen entfernen`
  }),
  
  // Import Sources
  IMPORT_SOURCES_READ: permission(Resources.IMPORT_SOURCES, Actions.READ, {
    category: _`Importquellen`,
    name: _`Importquellen anzeigen`,
    description: _`Datenquellen ansehen`
  }),
  IMPORT_SOURCES_CREATE: permission(Resources.IMPORT_SOURCES, Actions.CREATE, {
    category: _`Importquellen`,
    name: _`Importquellen erstellen`,
    description: _`Neue Datenquellen anlegen`
  }),
  IMPORT_SOURCES_UPDATE: permission(Resources.IMPORT_SOURCES, Actions.UPDATE, {
    category: _`Importquellen`,
    name: _`Importquellen bearbeiten`,
    description: _`Datenquellen ändern`
  }),

  // Users
  USERS_READ: permission(Resources.USERS, Actions.READ, {
    category: _`Benutzer`,
    name: _`Benutzer anzeigen`,
    description: _`Benutzerliste ansehen`
  }),
  USERS_UPDATE: permission(Resources.USERS, Actions.UPDATE, {
    category: _`Benutzer`,
    name: _`Benutzer bearbeiten`,
    description: _`Gruppenzuweisungen ändern`
  }),
  
  // Groups
  GROUPS_READ: permission(Resources.GROUPS, Actions.READ, {
    category: _`Gruppen`,
    name: _`Gruppen anzeigen`,
    description: _`Gruppenliste ansehen`
  }),
  GROUPS_CREATE: permission(Resources.GROUPS, Actions.CREATE, {
    category: _`Gruppen`,
    name: _`Gruppen erstellen`,
    description: _`Neue Gruppen anlegen`
  }),
  GROUPS_UPDATE: permission(Resources.GROUPS, Actions.UPDATE, {
    category: _`Gruppen`,
    name: _`Gruppen bearbeiten`,
    description: _`Gruppenberechtigungen ändern`
  }),
  GROUPS_DELETE: permission(Resources.GROUPS, Actions.DELETE, {
    category: _`Gruppen`,
    name: _`Gruppen löschen`,
    description: _`Gruppen entfernen`
  }),
} as const;
