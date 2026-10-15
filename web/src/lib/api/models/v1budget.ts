/* tslint:disable */
import { TypeDate } from './type-date';

/**
 * Budget represents a financial budget with a defined period.
 */
export interface V1Budget {

  /**
   * Creation timestamp.
   */
  create_time?: string;

  /**
   * Optional free-text description.
   */
  display_description?: string;

  /**
   * Human-readable budget name.
   */
  display_name: string;

  /**
   * Entity tag for optimistic concurrency control.
   */
  etag?: string;

  /**
   * Whether the budget is closed (no further modifications allowed).
   */
  is_closed?: boolean;

  /**
   * Whether the budget is published. Only published budgets allow their
   * revisions to be published.
   */
  is_published?: boolean;
  name?: string;

  /**
   * Position of the budget in the organization's custom ordering. A lower
   * value means a higher position; the first budget has the lowest value.
   * Assigned automatically; modified only via ReorderBudgets.
   */
  order?: number;

  /**
   * Budget period end date. Immutable after creation.
   */
  period_end: TypeDate;

  /**
   * Budget period start date. Immutable after creation.
   */
  period_start: TypeDate;

  /**
   * Whether current actual (Ist) account values are publicly visible.
   */
  publish_actual_values?: boolean;

  /**
   * Optional date until which current actual values are publicly visible.
   * Must lie within the budget period. If unset, the end of the budget period
   * is assumed.
   */
  publish_actual_values_until?: TypeDate;

  /**
   * The UUID of the budget.
   */
  uid?: string;

  /**
   * Last modification timestamp.
   */
  update_time?: string;
}
