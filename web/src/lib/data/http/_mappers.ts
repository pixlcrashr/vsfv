import {
  V1Account as ApiAccount,
  V1AccountGroup as ApiAccountGroup,
  V1AccountGroupAssignment as ApiAccountGroupAssignment,
  V1AuditLogEntry as ApiAuditLogEntry,
  V1Budget as ApiBudget,
  V1BudgetRevision as ApiBudgetRevision,
  V1NestedAccount as ApiNestedAccount,
  V1Report as ApiReport,
  V1ReportTemplate as ApiReportTemplate,
  V1Transaction as ApiTransaction,
  V1TransactionAssignment as ApiTransactionAssignment,
} from '../../api/models';

import {
  Account,
  AccountGroup,
  AccountGroupAssignment,
  AuditLogHistoryAction,
  AuditLogHistoryChange,
  AuditLogHistoryEntry,
  Budget,
  BudgetRevision,
  BudgetTag,
  HierarchicalAccount,
  Report,
  ReportTemplate,
  Transaction,
  TransactionAssignment,
} from '../../../app/shared/models';

export function toDateOnly(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function typeDateToDate(d: { year?: number; month?: number; day?: number }): Date {
  return new Date(d.year ?? 0, (d.month ?? 1) - 1, d.day ?? 1);
}

export function dateToTypeDate(d: Date): { year: number; month: number; day: number } {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function mapApiAccountGroup(g: ApiAccountGroup): AccountGroup {
  return {
    id: g.uid ?? '',
    name: g.display_name,
    description: g.display_description ?? '',
    assignmentCount: 0,
  };
}

export function mapApiAccount(a: ApiAccount): Account {
  const parentUid = a.parent_account ? a.parent_account.split('/').pop() ?? null : null;
  return {
    id: a.uid ?? '',
    name: a.display_name,
    code: a.display_code,
    fullCode: a.display_code,
    description: a.display_description ?? '',
    isArchived: a.is_archived ?? false,
    isContainer: a.is_container ?? false,
    parentAccountId: parentUid,
  };
}

export function mapApiNestedAccount(n: ApiNestedAccount, depth = 0): HierarchicalAccount {
  const a = n.account;
  const parentUid = a?.parent_account ? a.parent_account.split('/').pop() ?? null : null;
  return {
    id: a?.uid ?? '',
    name: a?.display_name ?? '',
    code: a?.display_code ?? '',
    fullCode: a?.display_code ?? '',
    description: a?.display_description ?? '',
    isArchived: a?.is_archived ?? false,
    isContainer: a?.is_container ?? false,
    parentAccountId: parentUid,
    depth,
    children: (n.children ?? []).map((c) => mapApiNestedAccount(c, depth + 1)),
  };
}

export function mapApiAccountGroupAssignment(
  a: ApiAccountGroupAssignment,
  accountName: string,
  accountCode: string,
): AccountGroupAssignment {
  return {
    id: a.uid ?? '',
    accountId: a.account_id,
    accountCode,
    accountName,
    operation: a.negate ? 'S' : 'A',
    targetValue: '0',
    actualValue: '0',
  };
}

export function mapApiBudget(b: ApiBudget): Budget {
  return {
    id: b.uid ?? '',
    displayName: b.display_name,
    displayDescription: b.display_description ?? '',
    periodStart: typeDateToDate(b.period_start),
    periodEnd: typeDateToDate(b.period_end),
    isClosed: b.is_closed ?? false,
    isPublished: b.is_published ?? false,
    publishActualValues: b.publish_actual_values ?? false,
    publishActualValuesUntil: b.publish_actual_values_until ? typeDateToDate(b.publish_actual_values_until) : null,
  };
}

export function mapApiBudgetRevision(r: ApiBudgetRevision): BudgetRevision {
  return {
    id: r.uid ?? '',
    date: r.date ? typeDateToDate(r.date) : new Date(),
    description: r.display_description ?? '',
    createdAt: new Date(r.create_time ?? ''),
    updatedAt: new Date(r.create_time ?? ''),
  };
}

export function mapApiBudgetTag(r: ApiBudgetRevision): BudgetTag {
  const date = r.date ? typeDateToDate(r.date) : new Date();

  return {
    id: r.uid ?? '',
    name: r.display_name ?? '',
    date,
    description: r.display_description ?? '',
    isPublished: r.is_published ?? false,
    createdAt: new Date(r.create_time ?? ''),
    updatedAt: new Date(r.create_time ?? ''),
  };
}

export function mapApiReportTemplate(t: ApiReportTemplate): ReportTemplate {
  return {
    id: t.uid ?? '',
    name: t.display_name,
    description: '',
    template: t.template,
    createdAt: new Date(t.create_time ?? ''),
    updatedAt: new Date(t.update_time ?? ''),
  };
}

export function mapApiReport(
  r: ApiReport,
  templateId?: string,
  templateName?: string,
): Report {
  return {
    id: r.uid ?? '',
    name: r.display_name,
    createdAt: new Date(r.create_time ?? ''),
    templateId: templateId ?? r.report_template_id ?? '',
    templateName: templateName ?? '',
  };
}

export function extractUidFromResourceName(resourceName: string): string {
  return resourceName.split('/').pop() ?? '';
}

function auditLogHistoryActionFromApi(value: string | undefined): AuditLogHistoryAction {
  const normalized = (value ?? '').replace(/^ACTION_/, '');
  return normalized === 'CREATE' || normalized === 'DELETE' ? normalized : 'UPDATE';
}

export function auditLogHistoryChangeFromApi(c: {
  field?: string;
  old_value?: string;
  new_value?: string;
}): AuditLogHistoryChange {
  return {
    field: c.field ?? '',
    oldValue: c.old_value === '' || c.old_value === undefined ? undefined : c.old_value,
    newValue: c.new_value === '' || c.new_value === undefined ? undefined : c.new_value,
  };
}

export function auditLogHistoryEntryFromApi(e: ApiAuditLogEntry): AuditLogHistoryEntry {
  return {
    id: e.uid ?? '',
    resource: e.resource ?? '',
    action: auditLogHistoryActionFromApi(e.action),
    actorId: e.actor ? extractUidFromResourceName(e.actor) || undefined : undefined,
    actorName: e.actor_display_name || undefined,
    changes: (e.changes ?? []).map(auditLogHistoryChangeFromApi),
    timestamp: e.timestamp ? new Date(e.timestamp) : new Date(0),
  };
}

export function mapApiTransaction(
  t: ApiTransaction,
  debitAccountCode: string,
  debitAccountName: string,
  creditAccountCode: string,
  creditAccountName: string,
  assignments: TransactionAssignment[],
  isLedgerClosed = false,
): Transaction {
  return {
    id: t.uid ?? '',
    documentDate: new Date(t.document_date),
    bookedAt: new Date(t.booked_at),
    updatedAt: new Date(t.update_time ?? ''),
    amount: t.amount?.value ?? '',
    debitLedgerAccountId: extractUidFromResourceName(t.debit_ledger_account),
    debitAccountCode,
    debitAccountName,
    creditLedgerAccountId: extractUidFromResourceName(t.credit_ledger_account),
    creditAccountCode,
    creditAccountName,
    description: t.description ?? '',
    assignedAccountId: null,
    isLedgerClosed,
    accountAssignments: assignments,
  };
}

export function mapApiTransactionAssignment(
  a: ApiTransactionAssignment,
  accountCode: string,
  accountName: string,
): TransactionAssignment {
  return {
    id: a.uid ?? '',
    accountId: extractUidFromResourceName(a.account),
    accountCode,
    accountName,
    value: a.value?.value ?? '',
  };
}
