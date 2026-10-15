/* tslint:disable */
import { V1BudgetRevisionAccountValue } from './v1budget-revision-account-value';
export interface V1ListBudgetRevisionAccountValuesResponse {

  /**
   * The account values returned.
   */
  account_values?: Array<V1BudgetRevisionAccountValue>;

  /**
   * A token to retrieve the next page of results.
   */
  next_page_token?: string;

  /**
   * Total number of account values matching the query.
   */
  total_size?: string;
}
