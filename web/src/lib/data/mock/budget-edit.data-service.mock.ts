import { Injectable } from '@angular/core';
import { Observable, of, delay, throwError } from 'rxjs';
import { faker } from '@faker-js/faker';
import { Decimal } from 'decimal.js';
import { AuditLogHistoryEntry, BudgetTag } from '../../../app/shared/models';
import {
  BudgetEditDataService,
  BudgetDetails,
  BudgetChange,
  UpdateBudgetParams,
} from '../../../app/routes/budgets/budget-edit/budget-edit.data-service';
import { SharedBudgetMockData } from './_shared-budget-data';
import { MockAuditHistory } from './_shared-audit-history';

@Injectable()
export class MockBudgetEditDataService extends BudgetEditDataService {
  private sharedData = SharedBudgetMockData.getInstance();
  private readonly auditHistory = new MockAuditHistory();

  private budgetResource(organizationId: string, id: string): string {
    return `organizations/${organizationId}/budgets/${id}`;
  }

  private revisionResource(organizationId: string, budgetId: string, revisionId: string): string {
    return `${this.budgetResource(organizationId, budgetId)}/revisions/${revisionId}`;
  }

  getBudget(organizationId: string, id: string): Observable<BudgetDetails> {
    const data = this.sharedData.getBudgetDetailsOrCreate(id);
    return of({ ...data.budget }).pipe(delay(300));
  }

  updateBudget(
    organizationId: string,
    id: string,
    params: UpdateBudgetParams,
  ): Observable<void> {
    const data = this.sharedData.getBudgetDetails(id);

    if (data) {
      const before = data.budget;
      const changes: Array<{ field: string; oldValue?: string; newValue?: string }> = [];
      if (before.displayName !== params.name) {
        changes.push({ field: 'display_name', oldValue: before.displayName, newValue: params.name });
      }
      if (before.displayDescription !== params.description) {
        changes.push({ field: 'display_description', oldValue: before.displayDescription, newValue: params.description });
      }
      if (before.isPublished !== params.isPublished) {
        changes.push({ field: 'is_published', oldValue: String(before.isPublished), newValue: String(params.isPublished) });
      }
      if (before.publishActualValues !== params.publishActualValues) {
        changes.push({ field: 'publish_actual_values', oldValue: String(before.publishActualValues), newValue: String(params.publishActualValues) });
      }
      if (changes.length > 0) {
        this.auditHistory.record(this.budgetResource(organizationId, id), 'UPDATE', changes);
      }

      data.budget.displayName = params.name;
      data.budget.displayDescription = params.description;
      data.budget.isPublished = params.isPublished;
      data.budget.publishActualValues = params.publishActualValues;
      data.budget.publishActualValuesUntil = params.publishActualValuesUntil ?? null;
    }
    return of(undefined).pipe(delay(300));
  }

  // Changes are now account-based and computed by the server.
  // In the mock, we keep the existing changes from the shared data.

  createBudgetRevision(organizationId: string, budgetId: string, date: Date, name: string, description: string, force: boolean): Observable<BudgetTag> {
    const data = this.sharedData.getBudgetDetails(budgetId);
    if (!data) {
      return throwError(() => new Error('Budget not found'));
    }

    // If not forcing and no changes exist, return error
    if (!force && !data.budget.hasUntaggedChanges) {
      return throwError(() => new Error('No changes to tag'));
    }

    const tag: BudgetTag = {
      id: faker.string.uuid(),
      name,
      date,
      description,
      isPublished: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    data.budget.tags.push(tag);

    // Update baseline snapshot to current state
    this.sharedData.updateBaseline(budgetId, {
      displayName: data.budget.displayName,
      displayDescription: data.budget.displayDescription,
      periodStart: data.budget.periodStart,
      periodEnd: data.budget.periodEnd,
    });

    // Reset changes after tagging
    data.budget.hasUntaggedChanges = false;
    data.budget.changes = [];

    this.auditHistory.record(this.revisionResource(organizationId, budgetId, tag.id), 'CREATE', [
      { field: 'display_name', newValue: name },
      { field: 'display_description', newValue: description },
    ]);

    return of(tag).pipe(delay(300));
  }

  updateBudgetRevision(organizationId: string, budgetId: string, id: string, isPublished: boolean): Observable<void> {
    const data = this.sharedData.getBudgetDetails(budgetId);
    if (data && isPublished && !data.budget.isPublished) {
      return throwError(() => new Error('Revision cannot be published if budget is not published'));
    }

    const allBudgets = this.sharedData.getAllBudgets();
    for (const budget of allBudgets) {
      const bd = this.sharedData.getBudgetDetails(budget.id);
      const tag = bd?.budget.tags.find((candidate) => candidate.id === id);
      if (tag) {
        tag.isPublished = isPublished;
        tag.updatedAt = new Date();
        this.auditHistory.record(
          this.revisionResource(organizationId, budgetId, id),
          'UPDATE',
          [{ field: 'is_published', oldValue: String(!isPublished), newValue: String(isPublished) }],
        );
        break;
      }
    }
    return of(undefined).pipe(delay(300));
  }

  deleteBudgetRevision(organizationId: string, id: string): Observable<void> {
    const allBudgets = this.sharedData.getAllBudgets();
    for (const budget of allBudgets) {
      const data = this.sharedData.getBudgetDetails(budget.id);
      if (data) {
        const index = data.budget.tags.findIndex((t) => t.id === id);
        if (index >= 0) {
          const tag = data.budget.tags[index];
          data.budget.tags.splice(index, 1);
          this.auditHistory.record(
            this.revisionResource(organizationId, budget.id, id),
            'DELETE',
            [{ field: 'display_name', oldValue: tag.name }],
          );
          break;
        }
      }
    }
    return of(undefined).pipe(delay(300));
  }

  closeBudget(organizationId: string, id: string): Observable<void> {
    this.sharedData.updateBudget(id, { isClosed: true });
    this.auditHistory.record(this.budgetResource(organizationId, id), 'UPDATE', [
      { field: 'is_closed', oldValue: 'false', newValue: 'true' },
    ]);
    return of(undefined).pipe(delay(300));
  }

  getAuditLog(organizationId: string, budgetId: string): Observable<AuditLogHistoryEntry[]> {
    return of(this.auditHistory.list(this.budgetResource(organizationId, budgetId))).pipe(delay(300));
  }

  override listAccountLabels(_organizationId: string): Observable<ReadonlyMap<string, string>> {
    return of(new Map<string, string>()).pipe(delay(300));
  }
}
