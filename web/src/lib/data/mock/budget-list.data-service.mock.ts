import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { faker } from '@faker-js/faker';
import { Budget } from '../../../app/shared/models';
import { BudgetListDataService } from '../../../app/routes/budgets/budget-list/budget-list.data-service';
import { SharedBudgetMockData } from './_shared-budget-data';

@Injectable()
export class MockBudgetListDataService extends BudgetListDataService {
  private sharedData = SharedBudgetMockData.getInstance();

  listBudgets(organizationId: string): Observable<Budget[]> {
    return of(this.sharedData.getAllBudgets()).pipe(delay(300));
  }

  createBudget(
    organizationId: string,
    name: string,
    description: string,
    startDate: Date,
    endDate: Date
  ): Observable<Budget> {
    const newBudget: Budget = {
      id: faker.string.uuid(),
      displayName: name,
      displayDescription: description,
      periodStart: startDate,
      periodEnd: endDate,
      isPublished: false,
      publishActualValues: false,
      isClosed: false,
      order: this.sharedData.getNextOrder(),
    };

    this.sharedData.addBudget(newBudget);

    return of(newBudget).pipe(delay(300));
  }

  deleteBudget(organizationId: string, id: string): Observable<void> {
    this.sharedData.deleteBudget(id);
    return of(undefined).pipe(delay(300));
  }

  reorderBudgets(organizationId: string, budgetIds: string[]): Observable<void> {
    this.sharedData.reorderBudgets(budgetIds);
    return of(undefined).pipe(delay(300));
  }
}
