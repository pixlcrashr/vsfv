import { faker } from '@faker-js/faker';
import { Decimal } from 'decimal.js';
import { Budget, BudgetTag } from '../../../app/shared/models';
import { BudgetDetails, BudgetChange } from '../../../app/routes/budgets/budget-edit/budget-edit.data-service';

export interface BudgetMockData {
  budget: BudgetDetails;
  baseline: Partial<BudgetDetails>;
}

export class SharedBudgetMockData {
  private static instance: SharedBudgetMockData;
  private budgets = new Map<string, BudgetMockData>();

  private constructor() {
    this.initializeBudgets();
  }

  static getInstance(): SharedBudgetMockData {
    if (!SharedBudgetMockData.instance) {
      SharedBudgetMockData.instance = new SharedBudgetMockData();
    }
    return SharedBudgetMockData.instance;
  }

  private initializeBudgets(): void {
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < 6; i++) {
      const year = currentYear - i;
      const id = faker.string.uuid();
      const startDate = new Date(year, 0, 1);

      // i === 0: current year with changes (open)
      // i === 1: current year without changes (open) - NEW
      // i > 1: closed budgets
      const budget: BudgetDetails = {
        id,
        displayName: i === 1 ? `Haushaltsplan ${year} (Entwurf)` : `Haushaltsplan ${year}`,
        displayDescription: faker.lorem.sentence(),
        periodStart: startDate,
        periodEnd: new Date(year, 11, 31),
        isClosed: i > 1,
        isPublished: i > 1,
        publishActualValues: false,
        publishActualValuesUntil: null,
        order: i,
        tags: this.generateTags(startDate, i > 1 ? 3 : 1),
        hasUntaggedChanges: i === 0,
        changes: [],
      };

      const baseline: Partial<BudgetDetails> = {
        displayName: budget.displayName,
        displayDescription: budget.displayDescription,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
      };

      // Add some mock changes to the current year budget (i === 0)
      if (i === 0) {
        budget.changes = [
          {
            accountId: faker.string.uuid(),
            accountFullCode: '1000-1100',
            accountName: 'Mitgliedsbeiträge',
            previousValue: new Decimal(5000),
            newValue: new Decimal(5500),
            diff: new Decimal(500),
          },
          {
            accountId: faker.string.uuid(),
            accountFullCode: '2000-2100',
            accountName: 'Personalkosten',
            previousValue: new Decimal(12000),
            newValue: new Decimal(11500),
            diff: new Decimal(-500),
          },
          {
            accountId: faker.string.uuid(),
            accountFullCode: '2000-2200',
            accountName: 'Sachkosten',
            previousValue: new Decimal(3000),
            newValue: new Decimal(3200),
            diff: new Decimal(200),
          },
        ];
      }
      // i === 1: budget with no changes (open)

      this.budgets.set(id, { budget, baseline });
    }
  }

  private generateTags(startDate: Date, count: number): BudgetTag[] {
    const tags: BudgetTag[] = [];

    for (let i = 0; i < count; i++) {
      const tagDate = new Date(startDate);
      tagDate.setMonth(tagDate.getMonth() + i * 3);

      const day = String(tagDate.getDate()).padStart(2, '0');
      const month = String(tagDate.getMonth() + 1).padStart(2, '0');
      const year = tagDate.getFullYear();
      const formattedDate = `${day}.${month}.${year}`;

      tags.push({
        id: faker.string.uuid(),
        name: i === 0 ? 'Ursprünglicher Plan' : formattedDate,
        date: tagDate,
        description: i === 0 ? 'Ursprünglicher Plan' : '',
        isPublished: i === 0,
        createdAt: tagDate,
        updatedAt: tagDate,
      });
    }

    return tags;
  }

  getAllBudgets(): Budget[] {
    return Array.from(this.budgets.values())
      .sort((a, b) => a.budget.order - b.budget.order)
      .map(data => ({
        id: data.budget.id,
        displayName: data.budget.displayName,
        displayDescription: data.budget.displayDescription,
        periodStart: data.budget.periodStart,
        periodEnd: data.budget.periodEnd,
        isClosed: data.budget.isClosed,
        isPublished: data.budget.isPublished,
        publishActualValues: data.budget.publishActualValues,
        publishActualValuesUntil: data.budget.publishActualValuesUntil,
        order: data.budget.order,
      }));
  }

  getNextOrder(): number {
    let max = -1;
    for (const data of this.budgets.values()) {
      if (data.budget.order > max) {
        max = data.budget.order;
      }
    }
    return max + 1;
  }

  reorderBudgets(ids: string[]): void {
    const reordered = new Map<string, BudgetMockData>();
    let order = 0;
    for (const id of ids) {
      const data = this.budgets.get(id);
      if (data) {
        data.budget.order = order++;
        reordered.set(id, data);
      }
    }
    for (const [id, data] of this.budgets) {
      if (!reordered.has(id)) {
        data.budget.order = order++;
        reordered.set(id, data);
      }
    }
    this.budgets = reordered;
  }

  getBudgetDetails(id: string): BudgetMockData | undefined {
    return this.budgets.get(id);
  }

  getBudgetDetailsOrCreate(id: string): BudgetMockData {
    if (!this.budgets.has(id)) {
      const year = new Date().getFullYear();
      const startDate = new Date(year, 0, 1);
      const prevDescription = 'Budget für das laufende Geschäftsjahr.';
      const newDescription = faker.lorem.sentence();

      const budget: BudgetDetails = {
        id,
        displayName: `Haushaltsplan ${year}`,
        displayDescription: newDescription,
        periodStart: startDate,
        periodEnd: new Date(year, 11, 31),
        isClosed: false,
        isPublished: false,
        publishActualValues: false,
        publishActualValuesUntil: null,
        order: this.getNextOrder(),
        tags: this.generateTags(startDate, 1),
        hasUntaggedChanges: true,
        changes: [
          {
            accountId: faker.string.uuid(),
            accountFullCode: '1000-1100',
            accountName: 'Mitgliedsbeiträge',
            previousValue: new Decimal(4000),
            newValue: new Decimal(4500),
            diff: new Decimal(500),
          },
          {
            accountId: faker.string.uuid(),
            accountFullCode: '2000-2100',
            accountName: 'Personalkosten',
            previousValue: new Decimal(10000),
            newValue: new Decimal(9500),
            diff: new Decimal(-500),
          },
        ],
      };

      const baseline: Partial<BudgetDetails> = {
        displayName: 'Entwurf Budget',
        displayDescription: prevDescription,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
      };

      this.budgets.set(id, { budget, baseline });
    }

    return this.budgets.get(id)!;
  }

  addBudget(budget: Budget): void {
    const budgetDetails: BudgetDetails = {
      ...budget,
      isPublished: budget.isPublished ?? false,
      publishActualValues: budget.publishActualValues ?? false,
      publishActualValuesUntil: budget.publishActualValuesUntil ?? null,
      tags: this.generateTags(budget.periodStart, 1),
      hasUntaggedChanges: false,
      changes: [],
    };

    const baseline: Partial<BudgetDetails> = {
      displayName: budget.displayName,
      displayDescription: budget.displayDescription,
      periodStart: budget.periodStart,
      periodEnd: budget.periodEnd,
    };

    this.budgets.set(budget.id, { budget: budgetDetails, baseline });
  }

  deleteBudget(id: string): void {
    this.budgets.delete(id);
  }

  updateBudget(id: string, updatedBudget: Partial<BudgetDetails>): void {
    const data = this.budgets.get(id);
    if (data) {
      Object.assign(data.budget, updatedBudget);
    }
  }

  updateBaseline(id: string, baseline: Partial<BudgetDetails>): void {
    const data = this.budgets.get(id);
    if (data) {
      data.baseline = baseline;
    }
  }
}
