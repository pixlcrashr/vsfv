import { Observable } from 'rxjs';
import { Budget } from '../../../shared/models';

export abstract class BudgetListDataService {
  abstract listBudgets(organizationId: string): Observable<Budget[]>;
  abstract createBudget(
    organizationId: string,
    name: string,
    description: string,
    startDate: Date,
    endDate: Date
  ): Observable<Budget>;
  abstract deleteBudget(organizationId: string, budgetId: string): Observable<void>;
  abstract reorderBudgets(organizationId: string, budgetIds: string[]): Observable<void>;
}
