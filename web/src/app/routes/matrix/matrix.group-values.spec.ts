import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Decimal } from 'decimal.js';
import { firstValueFrom, of, Observable } from 'rxjs';

import { Matrix } from './matrix.component';
import { Account, MatrixData, MatrixDataProviderService, MatrixStructure } from './matrix-data-provider.service';
import { MatrixDataService } from './matrix.data-service';
import { MatrixValueStoreService } from './matrix-value-store.service';
import { MatrixValuesCacheService } from './matrix-values-cache.service';
import { MockMatrixDataService } from '../../../lib/data/mock/matrix.data-service.mock';

describe('Matrix group account values', () => {
  async function setup(): Promise<{ component: Matrix; data: MatrixData; structure: MatrixStructure }> {
    await TestBed.configureTestingModule({
      imports: [Matrix],
      providers: [
        { provide: ActivatedRoute, useValue: { pathFromRoot: [] } },
        { provide: MatrixDataService, useClass: MockMatrixDataService },
        MatrixValuesCacheService,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Matrix);
    const component = fixture.componentInstance;
    const internals = component as unknown as {
      dataProvider: MatrixDataProviderService;
      buildGroupAccountValueSignals(): void;
    };

    const provider = internals.dataProvider;
    const structure = await firstValueFrom(provider.getStructure('test-org'));

    // Select every budget and revision, as the component does by default
    // when everything is selected.
    const budgetIds = structure.budgets.map(b => b.id);
    const tags = structure.budgets.flatMap(b => b.tags);
    await firstValueFrom(provider.loadValues('test-org', budgetIds, tags));

    const data = provider.buildMatrixData(structure, budgetIds, tags.map(t => t.id));

    component.matrixData.set(data);
    internals.buildGroupAccountValueSignals();

    return { component, data, structure };
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
      { id: 'a-10', code: '10', displayCode: '10', name: 'Ten', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
      { id: 'a-300', code: '300', displayCode: '300', name: 'Three hundred', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
      { id: 'a-2', code: '2', displayCode: '2', name: 'Two', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
      { id: 'a-2-10', code: '2.10', displayCode: '2.10', name: 'Two point ten', displayDescription: '', depth: 1, parentAccountId: 'a-2', isArchived: false },
      { id: 'a-1', code: '1', displayCode: '1', name: 'One', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
      { id: 'a-20', code: '20', displayCode: '20', name: 'Twenty', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
      { id: 'a-2-2', code: '2.2', displayCode: '2.2', name: 'Two point two', displayDescription: '', depth: 1, parentAccountId: 'a-2', isArchived: false },
      { id: 'a-3', code: '3', displayCode: '3', name: 'Three', displayDescription: '', depth: 0, parentAccountId: null, isArchived: false },
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
        MatrixValuesCacheService,
      ],
    });

    const provider = TestBed.inject(MatrixDataProviderService);
    const structure = await firstValueFrom(provider.getStructure('test-org'));
    const budgetIds = structure.budgets.map(b => b.id);
    const tags = structure.budgets.flatMap(b => b.tags);
    await firstValueFrom(provider.loadValues('test-org', budgetIds, tags));
    const data = provider.buildMatrixData(structure, budgetIds, tags.map(t => t.id));

    const expectedOrder = ['1', '2', '2.2', '2.10', '3', '10', '20', '300'];
    expect(data.accounts.map(a => a.displayCode)).toEqual(expectedOrder);
    expect(data.rows.filter(r => !r.isSumRow).map(r => r.displayCode)).toEqual(expectedOrder);
  });
});

describe('Matrix selection rebuild', () => {
  /**
   * Regression: changing the selection when every value is already cached
   * (e.g. deselecting a budget) rebuilds the matrix synchronously inside the
   * selection effect. When the effect tracked matrixData, that rebuild
   * re-triggered the effect endlessly and froze the page.
   */
  it('serves cached selection changes synchronously without re-triggering itself', async () => {
    await TestBed.configureTestingModule({
      imports: [Matrix],
      providers: [
        { provide: ActivatedRoute, useValue: { pathFromRoot: [], snapshot: { data: {} } } },
        { provide: MatrixDataService, useClass: MockMatrixDataService },
        MatrixValuesCacheService,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Matrix);
    const component = fixture.componentInstance;
    const internals = component as unknown as {
      orgId: string;
      loadStructure(saved: unknown): void;
    };
    internals.orgId = 'test-org';
    internals.loadStructure(null);

    // Let the mock structure fetch resolve; the selection effect then fires
    // and fetches the (default) selection values asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 600));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 700));
    fixture.detectChanges();

    expect(component.selectedBudgetIds().length).toBeGreaterThan(0);
    expect(component.matrixData().rows.some((row) => row.values.length > 0)).toBe(true);

    // Deselect the complete budget (its values are cached now): the rebuild
    // runs synchronously inside the effect and must terminate.
    component.selectedBudgetIds.set([]);
    component.selectedTagIds.set([]);
    fixture.detectChanges();

    expect(component.matrixData().rows.every((row) => row.values.length === 0)).toBe(true);
    expect(component.hasLoadedData()).toBe(true);
  });
});
