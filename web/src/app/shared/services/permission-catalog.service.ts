import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Permissions } from '../../../lib/authz/permissions';

export interface PermissionEntry {
  id: string;
  name: string;
  description: string;
}

export interface PermissionCategory {
  name: string;
  permissions: PermissionEntry[];
}

@Injectable({ providedIn: 'root' })
export class PermissionCatalogService {
  private readonly categories: PermissionCategory[] = [
    {
      name: 'Dashboard',
      permissions: [
        { id: Permissions.DASHBOARD_READ, name: 'Dashboard anzeigen', description: 'Dashboard einsehen' },
      ],
    },
    {
      name: 'Haushaltskonten',
      permissions: [
        { id: Permissions.ACCOUNTS_READ, name: 'Konten anzeigen', description: 'Haushaltskonten einsehen' },
        { id: Permissions.ACCOUNTS_CREATE, name: 'Konten erstellen', description: 'Haushaltskonten erstellen' },
        { id: Permissions.ACCOUNTS_UPDATE, name: 'Konten bearbeiten', description: 'Haushaltskonten ändern' },
        { id: Permissions.ACCOUNTS_DELETE, name: 'Konten löschen', description: 'Haushaltskonten löschen' },
        { id: Permissions.ACCOUNTS_ARCHIVE, name: 'Konten archivieren', description: 'Haushaltskonten archivieren' },
      ],
    },
    {
      name: 'Kontogruppen',
      permissions: [
        { id: Permissions.ACCOUNT_GROUPS_READ, name: 'Kontogruppen anzeigen', description: 'Kontogruppen einsehen' },
        { id: Permissions.ACCOUNT_GROUPS_CREATE, name: 'Kontogruppen erstellen', description: 'Kontogruppen erstellen' },
        { id: Permissions.ACCOUNT_GROUPS_UPDATE, name: 'Kontogruppen bearbeiten', description: 'Kontogruppen ändern' },
        { id: Permissions.ACCOUNT_GROUPS_DELETE, name: 'Kontogruppen löschen', description: 'Kontogruppen löschen' },
      ],
    },
    {
      name: 'Budgets',
      permissions: [
        { id: Permissions.BUDGETS_READ, name: 'Budgets anzeigen', description: 'Budgets einsehen' },
        { id: Permissions.BUDGETS_CREATE, name: 'Budgets erstellen', description: 'Budgets erstellen' },
        { id: Permissions.BUDGETS_UPDATE, name: 'Budgets bearbeiten', description: 'Budgets ändern' },
        { id: Permissions.BUDGETS_DELETE, name: 'Budgets löschen', description: 'Budgets löschen' },
        { id: Permissions.BUDGETS_CLOSE, name: 'Budgets abschließen', description: 'Budgets abschließen' },
      ],
    },
    {
      name: 'Journal',
      permissions: [
        { id: Permissions.JOURNAL_READ, name: 'Journal anzeigen', description: 'Journaleinträge einsehen' },
        { id: Permissions.JOURNAL_IMPORT, name: 'Journal importieren', description: 'Buchungen aus externen Quellen importieren' },
      ],
    },
    {
      name: 'Sachkonten',
      permissions: [
        { id: Permissions.LEDGER_ACCOUNT_READ, name: 'Sachkonten anzeigen', description: 'Sachkonten einsehen' },
        { id: Permissions.LEDGER_ACCOUNT_UPDATE, name: 'Sachkonten bearbeiten', description: 'Sachkonten ändern' },
        { id: Permissions.LEDGER_ACCOUNT_DELETE, name: 'Sachkonten löschen', description: 'Sachkonten löschen' },
      ],
    },
    {
      name: 'Geschäftsjahre',
      permissions: [
        { id: Permissions.LEDGER_YEAR_READ, name: 'Geschäftsjahre anzeigen', description: 'Geschäftsjahre einsehen' },
        { id: Permissions.LEDGER_YEAR_CREATE, name: 'Geschäftsjahre erstellen', description: 'Geschäftsjahre erstellen' },
        { id: Permissions.LEDGER_YEAR_CLOSE, name: 'Geschäftsjahre abschließen', description: 'Geschäftsjahre abschließen' },
        { id: Permissions.LEDGER_YEAR_DELETE, name: 'Geschäftsjahre löschen', description: 'Geschäftsjahre löschen' },
      ],
    },
    {
      name: 'Transaktionen',
      permissions: [
        { id: Permissions.TRANSACTIONS_READ, name: 'Transaktionen anzeigen', description: 'Transaktionen einsehen' },
        { id: Permissions.TRANSACTIONS_UPDATE, name: 'Transaktionen bearbeiten', description: 'Transaktionen ändern' },
        { id: Permissions.TRANSACTIONS_DELETE, name: 'Transaktionen löschen', description: 'Transaktionen löschen' },
      ],
    },
    {
      name: 'Matrix',
      permissions: [
        { id: Permissions.MATRIX_READ, name: 'Matrix anzeigen', description: 'Matrix einsehen' },
        { id: Permissions.MATRIX_UPDATE, name: 'Matrix bearbeiten', description: 'Matrix ändern' },
      ],
    },
    {
      name: 'Berichte',
      permissions: [
        { id: Permissions.REPORTS_READ, name: 'Berichte anzeigen', description: 'Berichte einsehen' },
        { id: Permissions.REPORTS_CREATE, name: 'Berichte erstellen', description: 'Berichte erstellen' },
        { id: Permissions.REPORTS_DELETE, name: 'Berichte löschen', description: 'Berichte löschen' },
      ],
    },
    {
      name: 'Berichtsvorlagen',
      permissions: [
        { id: Permissions.REPORT_TEMPLATES_READ, name: 'Vorlagen anzeigen', description: 'Berichtsvorlagen einsehen' },
        { id: Permissions.REPORT_TEMPLATES_CREATE, name: 'Vorlagen erstellen', description: 'Berichtsvorlagen erstellen' },
        { id: Permissions.REPORT_TEMPLATES_UPDATE, name: 'Vorlagen bearbeiten', description: 'Berichtsvorlagen ändern' },
        { id: Permissions.REPORT_TEMPLATES_DELETE, name: 'Vorlagen löschen', description: 'Berichtsvorlagen löschen' },
      ],
    },
    {
      name: 'Importquellen',
      permissions: [
        { id: Permissions.IMPORT_SOURCES_READ, name: 'Importquellen anzeigen', description: 'Importquellen einsehen' },
        { id: Permissions.IMPORT_SOURCES_CREATE, name: 'Importquellen erstellen', description: 'Importquellen erstellen' },
        { id: Permissions.IMPORT_SOURCES_UPDATE, name: 'Importquellen bearbeiten', description: 'Importquellen ändern' },
      ],
    },
    {
      name: 'Benutzerverwaltung',
      permissions: [
        { id: Permissions.USERS_READ, name: 'Benutzer anzeigen', description: 'Benutzer und deren Details einsehen' },
        { id: Permissions.USERS_UPDATE, name: 'Benutzer bearbeiten', description: 'Benutzer ändern' },
        { id: Permissions.GROUPS_READ, name: 'Gruppen anzeigen', description: 'Gruppen einsehen' },
        { id: Permissions.GROUPS_CREATE, name: 'Gruppen erstellen', description: 'Gruppen erstellen' },
        { id: Permissions.GROUPS_UPDATE, name: 'Gruppen bearbeiten', description: 'Gruppen ändern' },
        { id: Permissions.GROUPS_DELETE, name: 'Gruppen löschen', description: 'Gruppen löschen' },
      ],
    },
    {
      name: 'Einstellungen',
      permissions: [
        { id: Permissions.SETTINGS_READ, name: 'Einstellungen anzeigen', description: 'Einstellungen einsehen' },
        { id: Permissions.SETTINGS_UPDATE, name: 'Einstellungen bearbeiten', description: 'Einstellungen ändern' },
      ],
    },
    {
      name: 'Organisationen',
      permissions: [
        { id: Permissions.ORGANIZATIONS_READ, name: 'Organisationen anzeigen', description: 'Organisationen einsehen' },
        { id: Permissions.ORGANIZATIONS_CREATE, name: 'Organisationen erstellen', description: 'Organisationen erstellen' },
        { id: Permissions.ORGANIZATIONS_UPDATE, name: 'Organisationen bearbeiten', description: 'Organisationen ändern' },
        { id: Permissions.ORGANIZATIONS_ARCHIVE, name: 'Organisationen archivieren', description: 'Organisationen archivieren' },
        { id: Permissions.ORGANIZATIONS_DELETE, name: 'Organisationen löschen', description: 'Organisationen löschen' },
      ],
    },
    {
      name: 'Erstattungen',
      permissions: [
        { id: Permissions.REIMBURSEMENTS_READ, name: 'Erstattungen anzeigen', description: 'Alle Erstattungen einsehen' },
        { id: Permissions.REIMBURSEMENTS_CREATE, name: 'Erstattungen erstellen', description: 'Erstattungen beantragen' },
        { id: Permissions.REIMBURSEMENTS_COMMENT, name: 'Erstattungen kommentieren', description: 'Erstattungen kommentieren' },
        { id: Permissions.REIMBURSEMENTS_UPDATE, name: 'Erstattungen bearbeiten', description: 'Erstattungen ändern' },
        { id: Permissions.REIMBURSEMENTS_ARCHIVE, name: 'Erstattungen archivieren', description: 'Erstattungen archivieren' },
        { id: Permissions.REIMBURSEMENTS_READ_OWN, name: 'Eigene Erstattungen anzeigen', description: 'Eigene Erstattungen einsehen' },
        { id: Permissions.REIMBURSEMENTS_COMMENT_OWN, name: 'Eigene Erstattungen kommentieren', description: 'Eigene Erstattungen kommentieren' },
        { id: Permissions.REIMBURSEMENTS_UPDATE_OWN, name: 'Eigene Erstattungen bearbeiten', description: 'Eigene Erstattungen ändern' },
      ],
    },
    {
      name: 'Audit-Log',
      permissions: [
        { id: Permissions.AUDIT_LOGS_READ, name: 'Audit-Log anzeigen', description: 'Änderungshistorie einsehen' },
      ],
    },
  ];

  getPermissionCategories(): Observable<PermissionCategory[]> {
    return of(this.categories);
  }

  getPermissionCategoriesSync(): PermissionCategory[] {
    return this.categories;
  }
}
