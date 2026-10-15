import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BudgetServiceService } from '../../api/services/budget-service.service';
import { Budget } from '../../../app/shared/models';
import { BudgetListDataService } from '../../../app/routes/budgets/budget-list/budget-list.data-service';
import { mapApiBudget, dateToTypeDate } from './_mappers';

@Injectable()
export class HttpBudgetListDataService extends BudgetListDataService {
  private readonly svc = inject(BudgetServiceService);

  private budgetName(organizationId: string, uid: string): string {
    return `organizations/${organizationId}/budgets/${uid}`;
  }

  listBudgets(organizationId: string): Observable<Budget[]> {
    return this.svc.BudgetServiceListBudgets({ parent: `organizations/${organizationId}`, pageSize: 100 }).pipe(
      map((resp) => (resp.budgets ?? []).map(mapApiBudget)),
    );
  }

  createBudget(
    organizationId: string,
    name: string,
    description: string,
    startDate: Date,
    endDate: Date,
  ): Observable<Budget> {
    return this.svc.BudgetServiceCreateBudget({
      parent: `organizations/${organizationId}`,
      budget: {
        display_name: name,
        display_description: description,
        period_start: dateToTypeDate(startDate),
        period_end: dateToTypeDate(endDate),
      },
    }).pipe(map(mapApiBudget));
  }

  deleteBudget(organizationId: string, budgetId: string): Observable<void> {
    return this.svc.BudgetServiceDeleteBudget(this.budgetName(organizationId, budgetId)).pipe(map(() => undefined));
  }

  reorderBudgets(organizationId: string, budgetIds: string[]): Observable<void> {
    return this.svc.BudgetServiceReorderBudgets({
      parent: `organizations/${organizationId}`,
      body: {
        budgets: budgetIds.map((id) => this.budgetName(organizationId, id)),
      },
    }).pipe(map(() => undefined));
  }
}
