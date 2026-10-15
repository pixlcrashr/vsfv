/* tslint:disable */
export interface BudgetServiceReorderBudgetsBody {

  /**
   * The budget resource names in their desired order, from first (top of
   * lists) to last (bottom of lists). Must contain every budget of the
   * organization exactly once.
   */
  budgets: Array<string>;
}
