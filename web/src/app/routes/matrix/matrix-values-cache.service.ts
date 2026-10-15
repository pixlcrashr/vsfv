import { Injectable } from '@angular/core';
import { Decimal } from 'decimal.js';

/**
 * Route-scoped cache for the matrix values. Values are fetched per selection
 * (selected budgets and revisions only) and kept here for as long as the
 * matrix route is shown, so re-selecting a previously loaded budget or
 * revision does not trigger another request. Selecting a budget or revision
 * that is not cached yet fetches only the missing values.
 */
@Injectable()
export class MatrixValuesCacheService {
  /** budgetId -> accountId -> editable target value */
  private readonly editable = new Map<string, Map<string, Decimal>>();
  /** revision id (= tag id) -> accountId -> target value */
  private readonly target = new Map<string, Map<string, Decimal>>();
  /** budgetId -> accountId -> actual value */
  private readonly actual = new Map<string, Map<string, Decimal>>();

  hasBudget(budgetId: string): boolean {
    return this.editable.has(budgetId);
  }

  hasRevision(revisionId: string): boolean {
    return this.target.has(revisionId);
  }

  putEditable(budgetId: string, values: Map<string, Decimal>): void {
    this.editable.set(budgetId, values);
  }

  putTarget(revisionId: string, values: Map<string, Decimal>): void {
    this.target.set(revisionId, values);
  }

  putActual(budgetId: string, values: Map<string, Decimal>): void {
    this.actual.set(budgetId, values);
  }

  /** Drops every cached value; the next ensureValues refetches the selection. */
  clear(): void {
    this.editable.clear();
    this.target.clear();
    this.actual.clear();
  }

  /**
   * Read-only snapshots of the cached values, keyed as described on the
   * fields, used to build the matrix rows.
   */
  snapshot(): {
    editable: ReadonlyMap<string, ReadonlyMap<string, Decimal>>;
    target: ReadonlyMap<string, ReadonlyMap<string, Decimal>>;
    actual: ReadonlyMap<string, ReadonlyMap<string, Decimal>>;
  } {
    return {
      editable: this.editable,
      target: this.target,
      actual: this.actual,
    };
  }
}
