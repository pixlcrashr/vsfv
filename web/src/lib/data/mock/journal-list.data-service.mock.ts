import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { faker } from '@faker-js/faker';
import {
  JournalListDataService,
  JournalEntry,
  JournalEntryFilters,
  JournalAssignmentStatus,
} from '../../../app/routes/journal/journal-list/journal-list.data-service';

@Injectable()
export class MockJournalListDataService extends JournalListDataService {
  private readonly entries: JournalEntry[] = this.generateEntries();

  listTransactions(
    organizationId: string,
    pageSize: number,
    pageToken: string | undefined,
    filters: JournalEntryFilters = {},
  ): Observable<{ entries: JournalEntry[]; total: number; nextPageToken?: string }> {
    const page = pageToken ? parseInt(pageToken, 10) : 0;
    const filtered = this.applyFilters(this.entries, filters);
    const start = page * pageSize;
    const end = start + pageSize;
    const paged = filtered.slice(start, end);

    return of({
      entries: paged,
      total: filtered.length,
      nextPageToken: end < filtered.length ? String(page + 1) : undefined,
    }).pipe(delay(250));
  }

  private applyFilters(entries: JournalEntry[], filters: JournalEntryFilters): JournalEntry[] {
    const query = (filters.query ?? '').trim().toLowerCase();
    const afterDate = filters.afterDate ? new Date(filters.afterDate) : null;
    const beforeDate = filters.beforeDate ? new Date(filters.beforeDate) : null;

    if (beforeDate) {
      beforeDate.setHours(23, 59, 59, 999);
    }

    return entries.filter((entry) => {
      if (afterDate && entry.documentDate < afterDate) {
        return false;
      }

      if (beforeDate && entry.documentDate > beforeDate) {
        return false;
      }

      if (
        filters.assignmentStatus &&
        filters.assignmentStatus !== 'all' &&
        entry.assignmentStatus !== filters.assignmentStatus
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const assignmentsText = entry.accountAssignments
        .map((assignment) => `${assignment.accountCode} ${assignment.accountName}`)
        .join(' ')
        .toLowerCase();

      const haystack = [
        entry.reference,
        entry.description,
        entry.debitAccountCode,
        entry.debitAccountName,
        entry.creditAccountCode,
        entry.creditAccountName,
        assignmentsText,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  private generateEntries(): JournalEntry[] {
    const entries: JournalEntry[] = [];
    const transactionAccounts = [
      { id: 'ta-1100', code: '1100', name: 'Bank' },
      { id: 'ta-1200', code: '1200', name: 'Kasse' },
      { id: 'ta-2100', code: '2100', name: 'Personalkosten' },
      { id: 'ta-2200', code: '2200', name: 'Sachmittel' },
      { id: 'ta-2300', code: '2300', name: 'Veranstaltungen' },
      { id: 'ta-3100', code: '3100', name: 'Mitgliedsbeiträge' },
      { id: 'ta-3200', code: '3200', name: 'Zuschüsse' },
    ];
    const budgetAccounts = [
      { id: 'acc-1', code: '2.1.1', fullCode: '2-1-1', name: 'Gehälter' },
      { id: 'acc-2', code: '2.1.2', fullCode: '2-1-2', name: 'Sozialabgaben' },
      { id: 'acc-3', code: '2.2.1', fullCode: '2-2-1', name: 'Büromaterial' },
      { id: 'acc-4', code: '2.2.2', fullCode: '2-2-2', name: 'IT-Ausstattung' },
      { id: 'acc-5', code: '2.3.1', fullCode: '2-3-1', name: 'Veranstaltungsräume' },
      { id: 'acc-6', code: '3.1.1', fullCode: '3-1-1', name: 'Mitgliedsverwaltung' },
    ];
    const statuses: JournalAssignmentStatus[] = ['ignored', 'assigned', 'partial', 'open'];

    for (let i = 0; i < 120; i++) {
      const debitAccount = transactionAccounts[i % transactionAccounts.length];
      let creditAccount = transactionAccounts[(i + 1) % transactionAccounts.length];
      while (creditAccount.code === debitAccount.code) {
        creditAccount = transactionAccounts[(i + 2) % transactionAccounts.length];
      }

      const date = faker.date.recent({ days: 365 });
      const amount = faker.number.float({ min: 10, max: 5000, fractionDigits: 2 }).toFixed(2);
      const assignmentStatus = statuses[i % statuses.length];

      entries.push({
        id: faker.string.uuid(),
        documentDate: date,
        bookedAt: new Date(date.getTime() + 86400000),
        amount,
        reference: `BN-${date.getFullYear()}-${String(i + 1).padStart(4, '0')}`,
        debitAccountCode: debitAccount.code,
        debitAccountName: debitAccount.name,
        creditAccountCode: creditAccount.code,
        creditAccountName: creditAccount.name,
        description: faker.finance.transactionDescription(),
        assignmentStatus,
        accountAssignments: this.generateAssignments(assignmentStatus, amount, budgetAccounts),
      });
    }

    entries.sort((a, b) => b.documentDate.getTime() - a.documentDate.getTime());

    return entries;
  }

  private generateAssignments(
    status: JournalAssignmentStatus,
    amount: string,
    accounts: { id: string; code: string; fullCode: string; name: string }[],
  ): JournalEntry['accountAssignments'] {
    if (status === 'ignored' || status === 'open') {
      return [];
    }

    const totalCents = Math.round(parseFloat(amount) * 100);
    const isFullyAssigned = status === 'assigned';
    const targetCents = isFullyAssigned
      ? totalCents
      : Math.max(1, Math.floor(totalCents * faker.number.float({ min: 0.3, max: 0.8 })));

    // At most one assignment per transaction (1:1 mapping between value and account).
    const account = accounts[faker.number.int({ min: 0, max: accounts.length - 1 })];

    return [
      {
        id: faker.string.uuid(),
        accountId: account.id,
        accountCode: account.code,
        accountFullCode: account.fullCode,
        accountName: account.name,
        value: (targetCents / 100).toFixed(2),
      },
    ];
  }
}
