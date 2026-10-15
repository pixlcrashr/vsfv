import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { faker } from '@faker-js/faker';
import { AccountGroupStats, Budget, BudgetTag } from '../../../app/shared/models';
import { AccountGroupStatsDataService } from '../../../app/routes/account-groups/account-group-stats/account-group-stats.data-service';

@Injectable()
export class MockAccountGroupStatsDataService extends AccountGroupStatsDataService {
  private readonly budgets: Budget[] = [
    {
      id: 'b1',
      displayName: 'Haushaltsplan 2025',
      displayDescription: 'Aktueller Haushaltsplan',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-12-31'),
      isPublished: false,
      publishActualValues: false,
      isClosed: false,
      order: 0,
    },
    {
      id: 'b2',
      displayName: 'Haushaltsplan 2024',
      displayDescription: 'Vorjahr',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-12-31'),
      isPublished: true,
      publishActualValues: true,
      isClosed: true,
      order: 1,
    },
  ];

  private readonly tags: Record<string, BudgetTag[]> = {
    b1: [
      { id: 't1', name: 'Q1 Abschluss', date: new Date('2025-03-31'), description: 'Quartal 1', createdAt: new Date(), updatedAt: new Date() },
      { id: 't2', name: 'Halbjahr', date: new Date('2025-06-30'), description: 'Halbjahresbericht', createdAt: new Date(), updatedAt: new Date() },
    ],
    b2: [
      { id: 't3', name: 'Jahresabschluss', date: new Date('2024-12-31'), description: 'Endgültiger Abschluss', createdAt: new Date(), updatedAt: new Date() },
    ],
  };

  private readonly accounts = [
    { id: faker.string.uuid(), accountId: faker.string.uuid(), accountCode: '2.1.1', accountName: 'Gehälter', operation: 'A' as const },
    { id: faker.string.uuid(), accountId: faker.string.uuid(), accountCode: '2.1.2', accountName: 'Sozialabgaben', operation: 'A' as const },
    { id: faker.string.uuid(), accountId: faker.string.uuid(), accountCode: '2.1.3', accountName: 'Weiterbildung', operation: 'S' as const },
    { id: faker.string.uuid(), accountId: faker.string.uuid(), accountCode: '2.1.4', accountName: 'Reisekosten Personal', operation: 'A' as const },
    { id: faker.string.uuid(), accountId: faker.string.uuid(), accountCode: '2.1.5', accountName: 'Werkverträge', operation: 'A' as const },
  ];

  listBudgets(organizationId: string): Observable<Budget[]> {
    return of(this.budgets).pipe(delay(200));
  }

  listBudgetRevisions(organizationId: string, budgetId: string): Observable<BudgetTag[]> {
    return of(this.tags[budgetId] ?? []).pipe(delay(200));
  }

  getGroupStats(organizationId: string, groupId: string, budgetId: string): Observable<AccountGroupStats> {
    const accounts = this.accounts.map(a => ({
      ...a,
      targetValue: (Math.random() * 20000 + 5000).toFixed(2),
      actualValue: (Math.random() * 18000 + 3000).toFixed(2),
    }));
    const targetValue = accounts.reduce((s, a) => s + (a.operation === 'S' ? -1 : 1) * parseFloat(a.targetValue), 0);
    const actualValue = accounts.reduce((s, a) => s + (a.operation === 'S' ? -1 : 1) * parseFloat(a.actualValue), 0);

    return of({
      id: groupId,
      name: 'Personalkosten',
      targetValue: targetValue.toFixed(2),
      actualValue: actualValue.toFixed(2),
      transactionCount: 127,
      accounts,
    }).pipe(delay(300));
  }

  getGroupStatsByRevision(organizationId: string, groupId: string, budgetId: string, tagId: string): Observable<AccountGroupStats> {
    const accounts = this.accounts.map(a => ({
      ...a,
      targetValue: (Math.random() * 15000 + 3000).toFixed(2),
      actualValue: (Math.random() * 18000 + 3000).toFixed(2),
    }));
    const targetValue = accounts.reduce((s, a) => s + (a.operation === 'S' ? -1 : 1) * parseFloat(a.targetValue), 0);
    const actualValue = accounts.reduce((s, a) => s + (a.operation === 'S' ? -1 : 1) * parseFloat(a.actualValue), 0);

    return of({
      id: groupId,
      name: 'Personalkosten',
      targetValue: targetValue.toFixed(2),
      actualValue: actualValue.toFixed(2),
      transactionCount: 127,
      accounts,
    }).pipe(delay(300));
  }
}
