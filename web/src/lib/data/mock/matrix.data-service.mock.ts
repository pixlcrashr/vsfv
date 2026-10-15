import { Injectable } from '@angular/core';
import { Observable, of, delay, map } from 'rxjs';
import { faker } from '@faker-js/faker';
import { Account, Budget } from '../../../app/routes/matrix/matrix-data-provider.service';
import {
  MatrixActualValues,
  MatrixBudgetValueUpdate,
  MatrixEditableValuesByBudget,
  MatrixTargetValues
} from '../../../app/routes/matrix/matrix.data-service';
import { MatrixDataService } from '../../../app/routes/matrix/matrix.data-service';
import { Decimal } from 'decimal.js';



const ACCOUNT_IDS = [
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
  faker.string.uuid(),
];

const MOCK_ACCOUNTS: Account[] = [
  { id: ACCOUNT_IDS[0], code: '1000', displayCode: '1000', name: 'Einnahmen', displayDescription: 'Alle Einnahmen des Haushaltsplans', depth: 0, parentAccountId: null, isArchived: false },
  { id: ACCOUNT_IDS[1], code: '1100', displayCode: '1100', name: 'Steuern', displayDescription: 'Steuereinnahmen', depth: 1, parentAccountId: ACCOUNT_IDS[0], isArchived: false },
  { id: ACCOUNT_IDS[2], code: '1110', displayCode: '1110', name: 'Umsatzsteuer', displayDescription: 'Umsatzsteuer des laufenden Jahres', depth: 2, parentAccountId: ACCOUNT_IDS[1], isArchived: false },
  { id: ACCOUNT_IDS[3], code: '1120', displayCode: '1120', name: 'Gewerbesteuer', displayDescription: 'Gemeinsame Steuern nach KoDex', depth: 2, parentAccountId: ACCOUNT_IDS[1], isArchived: false },
  { id: ACCOUNT_IDS[4], code: '1200', displayCode: '1200', name: 'Zuweisungen', displayDescription: 'Zuweisungen von Land und Bund', depth: 1, parentAccountId: ACCOUNT_IDS[0], isArchived: false },
  { id: ACCOUNT_IDS[5], code: '1210', displayCode: '1210', name: 'Landesmittel', displayDescription: 'Landeszuschüsse', depth: 2, parentAccountId: ACCOUNT_IDS[4], isArchived: false },
  { id: ACCOUNT_IDS[6], code: '1211', displayCode: '1211', name: 'Projektfoerderung', displayDescription: 'Förderung einzelner Projekte', depth: 3, parentAccountId: ACCOUNT_IDS[5], isArchived: false },
  { id: ACCOUNT_IDS[7], code: '2000', displayCode: '2000', name: 'Ausgaben', displayDescription: 'Alle Ausgaben des Haushaltsplans', depth: 0, parentAccountId: null, isArchived: false },
  { id: ACCOUNT_IDS[8], code: '2100', displayCode: '2100', name: 'Personal', displayDescription: 'Personalausgaben', depth: 1, parentAccountId: ACCOUNT_IDS[7], isArchived: false },
  { id: ACCOUNT_IDS[9], code: '2110', displayCode: '2110', name: 'Wissenschaftliches Personal', displayDescription: 'Tutorien und wissenschaftliche Mitarbeiter', depth: 2, parentAccountId: ACCOUNT_IDS[8], isArchived: false },
  { id: ACCOUNT_IDS[10], code: '2200', displayCode: '2200', name: 'Sachausgaben', displayDescription: 'Sachmittel', depth: 1, parentAccountId: ACCOUNT_IDS[7], isArchived: false },
  { id: ACCOUNT_IDS[11], code: '2210', displayCode: '2210', name: 'IT-Infrastruktur', displayDescription: 'Server, Netzwerk und Arbeitsplätze', depth: 2, parentAccountId: ACCOUNT_IDS[10], isArchived: false },
  { id: ACCOUNT_IDS[12], code: '2211', displayCode: '2211', name: 'Lizenzen', displayDescription: 'Softwarelizenzen', depth: 3, parentAccountId: ACCOUNT_IDS[11], isArchived: false },
  { id: ACCOUNT_IDS[13], code: '9000', displayCode: '9000', name: 'Archiviertes Konto', displayDescription: '', depth: 0, parentAccountId: null, isArchived: true },
];

const LEAF_ACCOUNTS = MOCK_ACCOUNTS.filter(
  account => !MOCK_ACCOUNTS.some(candidate => candidate.parentAccountId === account.id)
);

const MOCK_BUDGETS: Budget[] = (() => {
  const budgets: Budget[] = [];
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < 3; i++) {
    const year = currentYear - i;
    const budgetId = faker.string.uuid();
    budgets.push({
      id: budgetId,
      displayName: `Haushaltsplan ${year}`,
      displayDescription: `Beschreibung für ${year}`,
      isClosed: i > 0,
      periodStart: new Date(year, 0, 1),
      tags: [
        {
          id: faker.string.uuid(),
          name: `organizations/org/budgets/${budgetId}/revisions/rev-${year}-2`,
          displayName: 'Revision 2',
          displayDescription: 'Nachtrag 1',
          date: new Date(year, 5, 1),
          createdAt: new Date(year, 5, 1)
        },
        {
          id: faker.string.uuid(),
          name: `organizations/org/budgets/${budgetId}/revisions/rev-${year}-1`,
          displayName: 'Revision 1',
          displayDescription: 'Ursprünglicher Plan',
          date: new Date(year, 0, 1),
          createdAt: new Date(year, 0, 1)
        }
      ]
    });
  }

  return budgets;
})();

const MOCK_EDITABLE_VALUES: MatrixEditableValuesByBudget[] = MOCK_BUDGETS.map(budget => ({
  budgetId: budget.id,
  editableValues: Object.fromEntries(
    LEAF_ACCOUNTS.map(account => [
      account.id,
      new Decimal(faker.finance.amount({ min: 1000, max: 100000, dec: 2 }))
    ])
  )
}));

@Injectable()
export class MockMatrixDataService extends MatrixDataService {
  listBudgets(organizationId: string): Observable<Budget[]> {
    return of(MOCK_BUDGETS).pipe(delay(500));
  }

  listAccounts(organizationId: string): Observable<Account[]> {
    return of(MOCK_ACCOUNTS).pipe(delay(500));
  }

  listMatrixTargetValues(organizationId: string, revisionNames: string[]): Observable<MatrixTargetValues> {
    const revisions = MOCK_BUDGETS.flatMap(budget => budget.tags)
      .filter(tag => revisionNames.includes(tag.name));
    return of(
      Object.fromEntries(
        revisions.map(tag => [
          tag.id,
          Object.fromEntries(
            LEAF_ACCOUNTS.map(account => [
              account.id,
              { targetValue: new Decimal(faker.finance.amount({ min: 1000, max: 100000, dec: 2 })) }
            ])
          )
        ])
      )
    ).pipe(delay(500));
  }

  listMatrixActualValues(organizationId: string, budgetIds: string[]): Observable<MatrixActualValues> {
    return of(
      Object.fromEntries(
        MOCK_BUDGETS.filter(budget => budgetIds.includes(budget.id)).map(budget => [
          budget.id,
          Object.fromEntries(
            LEAF_ACCOUNTS.map(account => [
              account.id,
              { actualValue: new Decimal(faker.finance.amount({ min: 1000, max: 100000, dec: 2 })) }
            ])
          )
        ])
      )
    ).pipe(delay(500));
  }

  listMatrixEditableValues(organizationId: string, budgetIds: string[]): Observable<MatrixEditableValuesByBudget[]> {
    return of(MOCK_EDITABLE_VALUES.filter(entry => budgetIds.includes(entry.budgetId))).pipe(delay(500));
  }

  updateMatrixBudgetValues(organizationId: string, updates: MatrixBudgetValueUpdate[]): Observable<void> {
    console.log('MockMatrixDataService.updateMatrixBudgetValues called with:', updates);

    updates.forEach(update => {
      const budgetEditable = MOCK_EDITABLE_VALUES.find(b => b.budgetId === update.budgetId);
      if (budgetEditable) {
        budgetEditable.editableValues[update.accountId] = update.value;
      }
    });

    return of(undefined).pipe(delay(300));
  }
}
