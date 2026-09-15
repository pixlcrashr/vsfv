import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Decimal } from 'decimal.js';
import { firstValueFrom, of, Observable } from 'rxjs';

import { Matrix } from './matrix.component';
import { Account, MatrixData, MatrixDataProviderService } from './matrix-data-provider.service';
import { MatrixDataService } from './matrix.data-service';
import { MatrixValueStoreService } from './matrix-value-store.service';
import { MockMatrixDataService } from '../../../lib/data/mock/matrix.data-service.mock';

describe('Matrix group account values', () => {
  async function setup(): Promise<{ component: Matrix; data: MatrixData }> {
    await TestBed.configureTestingModule({
      imports: [Matrix],
      providers: [
        { provide: ActivatedRoute, useValue: { pathFromRoot: [] } },
        { provide: MatrixDataService, useClass: MockMatrixDataService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Matrix);
    const component = fixture.componentInstance;
    const internals = component as unknown as {
      dataProvider: { getMatrixData(orgId: string): { subscribe(obs: { next(d: MatrixData): void }): void } };
      buildGroupAccountValueSignals(): void;
    };

    const data = await new Promise<MatrixData>(resolve => {
      internals.dataProvider.getMatrixData('test-org').subscribe({ next: resolve });
    });

    component.matrixData.set(data);
    internals.buildGroupAccountValueSignals();

    return { component, data };
  }

  function childrenByParentOf(data: MatrixData): Map<string | null, string[]> {
    const childrenByParent = new Map<string | null, string[]>();
    for (const account of data.accounts) {
      const siblings = childrenByParent.get(account.parentAccountId) ?? [];
      siblings.push(account.id);
      childrenByParent.set(account.parentAccountId, siblings);
    }
    return childrenByParent;
  }

  it('populates group account sums locally for every budget revision', async () => {
    const { component, data } = await setup();
    const childrenByParent = childrenByParentOf(data);

    const leafTarget = (budgetId: string, tagId: string, accountId: string): Decimal => {
      const row = data.rows.find(r => r.accountId === accountId);
      const value = row?.values.find(v => v.budgetId === budgetId);
      const tag = value?.tags.find(t => t.tagId === tagId);
      return tag ? tag.targetValue() : new Decimal(0);
    };

    const sumLeafDescendants = (budgetId: string, tagId: string, accountId: string): Decimal => {
      let sum = new Decimal(0);
      for (const childId of childrenByParent.get(accountId) ?? []) {
        if ((childrenByParent.get(childId) ?? []).length > 0) {
          sum = sum.plus(sumLeafDescendants(budgetId, tagId, childId));
        } else {
          sum = sum.plus(leafTarget(budgetId, tagId, childId));
        }
      }
      return sum;
    };

    const groupAccounts = data.accounts.filter(a => (childrenByParent.get(a.id) ?? []).length > 0);
    expect(groupAccounts.length).toBeGreaterThan(0);

    for (const budget of data.budgets) {
      for (const tag of budget.tags) {
        for (const group of groupAccounts) {
          const signal = component.getGroupAccountValue(budget.id, tag.id, group.id);
          expect(signal).toBeDefined();

          const expected = sumLeafDescendants(budget.id, tag.id, group.id);
          const actual = signal!();
          expect(actual.toString()).toBe(expected.toString());
        }
      }
    }
  });

  it('exposes the sums on parent and sum rows', async () => {
    const { component, data } = await setup();
    const childrenByParent = childrenByParentOf(data);

    const parentRows = component.matrixData().rows.filter(r => r.isParent);
    expect(parentRows.length).toBeGreaterThan(0);

    for (const row of parentRows) {
      const children = childrenByParent.get(row.accountId) ?? [];
      expect(children.length).toBeGreaterThan(0);

      for (const value of row.values) {
        for (const tag of value.tags) {
          let expected = new Decimal(0);
          for (const childId of children) {
            const childRow = component.matrixData().rows.find(r => r.accountId === childId);
            const childTag = childRow?.values
              .find(v => v.budgetId === value.budgetId)
              ?.tags.find(t => t.tagId === tag.tagId);
            expected = expected.plus(childTag ? childTag.targetValue() : new Decimal(0));
          }

          expect(tag.targetValue().toString()).toBe(expected.toString());
        }
      }

      const sumRow = component.matrixData().rows.find(r => r.sourceAccountId === row.accountId);
      expect(sumRow).toBeDefined();
    }
  });
});

describe('Matrix account tree ordering', () => {
  it('sorts the account tree naturally by display code (1, 2, 10 — not 1, 10, 2)', async () => {
    const scrambledAccounts: Account[] = [
      { id: 'a-10', displayCode: '10', name: 'Ten', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
      { id: 'a-300', displayCode: '300', name: 'Three hundred', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
      { id: 'a-2', displayCode: '2', name: 'Two', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
      { id: 'a-2-10', displayCode: '2.10', name: 'Two point ten', displayDescription: '', depth: 1, parentAccountId: 'a-2', isArchived: false },
      { id: 'a-1', displayCode: '1', name: 'One', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
      { id: 'a-20', displayCode: '20', name: 'Twenty', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
      { id: 'a-2-2', displayCode: '2.2', name: 'Two point two', displayDescription: '', depth: 1, parentAccountId: 'a-2', isArchived: false },
      { id: 'a-3', displayCode: '3', name: 'Three', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
    ];

    class ScrambledAccountsMock extends MockMatrixDataService {
      override listAccounts(): Observable<Account[]> {
        return of(scrambledAccounts);
      }
    }

    TestBed.configureTestingModule({
      providers: [
        { provide: MatrixDataService, useClass: ScrambledAccountsMock },
        MatrixDataProviderService,
        MatrixValueStoreService,
      ],
    });

    const provider = TestBed.inject(MatrixDataProviderService);
    const data = await firstValueFrom(provider.getMatrixData('test-org'));

    const expectedOrder = ['1', '2', '2.2', '2.10', '3', '10', '20', '300'];
    expect(data.accounts.map(a => a.displayCode)).toEqual(expectedOrder);
    expect(data.rows.filter(r => !r.isSumRow).map(r => r.displayCode)).toEqual(expectedOrder);
  });
});
