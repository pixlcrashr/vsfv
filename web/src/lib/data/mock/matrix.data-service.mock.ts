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
  { id: ACCOUNT_IDS[0], displayCode: '1000', name: 'Einnahmen', displayDescription: 'Alle Einnahmen des Haushaltsplans', depth: 0, parentAccountId: null, isArchived: false },
  { id: ACCOUNT_IDS[1], displayCode: '1100', name: 'Steuern', displayDescription: 'Steuereinnahmen', depth: 1, parentAccountId: ACCOUNT_IDS[0], isArchived: false },
  { id: ACCOUNT_IDS[2], displayCode: '1110', name: 'Umsatzsteuer', displayDescription: 'Umsatzsteuer des laufenden Jahres', depth: 2, parentAccountId: ACCOUNT_IDS[1], isArchived: false },
  { id: ACCOUNT_IDS[3], displayCode: '1120', name: 'Gewerbesteuer', displayDescription: 'Gemeinsame Steuern nach KoDex', depth: 2, parentAccountId: ACCOUNT_IDS[1], isArchived: false },
  { id: ACCOUNT_IDS[4], displayCode: '1200', name: 'Zuweisungen', displayDescription: 'Zuweisungen von Land und Bund', depth: 1, parentAccountId: ACCOUNT_IDS[0], isArchived: false },
  { id: ACCOUNT_IDS[5], displayCode: '1210', name: 'Landesmittel', displayDescription: 'Landeszuschüsse', depth: 2, parentAccountId: ACCOUNT_IDS[4], isArchived: false },
  { id: ACCOUNT_IDS[6], displayCode: '1211', name: 'Projektfoerderung', displayDescription: 'Förderung einzelner Projekte', depth: 3, parentAccountId: ACCOUNT_IDS[5], isArchived: false },
  { id: ACCOUNT_IDS[7], displayCode: '2000', name: 'Ausgaben', displayDescription: 'Alle Ausgaben des Haushaltsplans', depth: 0, parentAccountId: null, isArchived: false },
  { id: ACCOUNT_IDS[8], displayCode: '2100', name: 'Personal', displayDescription: 'Personalausgaben', depth: 1, parentAccountId: ACCOUNT_IDS[7], isArchived: false },
  { id: ACCOUNT_IDS[9], displayCode: '2110', name: 'Wissenschaftliches Personal', displayDescription: 'Tutorien und wissenschaftliche Mitarbeiter', depth: 2, parentAccountId: ACCOUNT_IDS[8], isArchived: false },
  { id: ACCOUNT_IDS[10], displayCode: '2200', name: 'Sachausgaben', displayDescription: 'Sachmittel', depth: 1, parentAccountId: ACCOUNT_IDS[7], isArchived: false },
  { id: ACCOUNT_IDS[11], displayCode: '2210', name: 'IT-Infrastruktur', displayDescription: 'Server, Netzwerk und Arbeitsplätze', depth: 2, parentAccountId: ACCOUNT_IDS[10], isArchived: false },
  { id: ACCOUNT_IDS[12], displayCode: '2211', name: 'Lizenzen', displayDescription: 'Softwarelizenzen', depth: 3, parentAccountId: ACCOUNT_IDS[11], isArchived: false },
  { id: ACCOUNT_IDS[13], displayCode: '9000', name: 'Archiviertes Konto', displayDescription: '', depth: 0, parentAccountId: null, isArchived: true },
];

const LEAF_ACCOUNTS = MOCK_ACCOUNTS.filter(
  account => !MOCK_ACCOUNTS.some(candidate => candidate.parentAccountId === account.id)
);

const MOCK_BUDGETS: Budget[] = (() => {
  const budgets: Budget[] = [];
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < 3; i++) {
    const year = currentYear - i;
    budgets.push({
      id: faker.string.uuid(),
      displayName: `Haushaltsplan ${year}`,
      displayDescription: `Beschreibung für ${year}`,
      isClosed: i > 0,
      tags: [
        {
          id: faker.string.uuid(),
          displayName: 'Revision 1',
          displayDescription: 'Ursprünglicher Plan',
          createdAt: new Date(year, 0, 1)
        },
        {
          id: faker.string.uuid(),
          displayName: 'Revision 2',
          displayDescription: 'Nachtrag 1',
          createdAt: new Date(year, 5, 1)
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

  listMatrixTargetValues(organizationId: string): Observable<MatrixTargetValues> {
    return this.listBudgets(organizationId).pipe(
      map(budgets => {
        const values: MatrixTargetValues = {};
        budgets.forEach(budget => {
          budget.tags.forEach(tag => {
            values[tag.id] = {};
            LEAF_ACCOUNTS.forEach(account => {
              values[tag.id][account.id] = {
                targetValue: new Decimal(faker.finance.amount({ min: 1000, max: 100000, dec: 2 }))
              };
            });
          });
        });
        return values;
      }),
      delay(500)
    );
  }

  listMatrixActualValues(organizationId: string): Observable<MatrixActualValues> {
    return this.listBudgets(organizationId).pipe(
      map(budgets => {
        const values: MatrixActualValues = {};
        budgets.forEach(budget => {
          values[budget.id] = {};
          LEAF_ACCOUNTS.forEach(account => {
            values[budget.id][account.id] = {
              actualValue: new Decimal(faker.finance.amount({ min: 1000, max: 100000, dec: 2 }))
            };
          });
        });
        return values;
      }),
      delay(500)
    );
  }

  listMatrixEditableValues(organizationId: string): Observable<MatrixEditableValuesByBudget[]> {
    return of(MOCK_EDITABLE_VALUES).pipe(delay(500));
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
