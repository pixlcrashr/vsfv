/* tslint:disable */
import { V1SubmissionTypeIncomeExpenseDetails } from './v1submission-type-income-expense-details';
import { V1SubmissionTypeMiscDetails } from './v1submission-type-misc-details';
import { V1SubmissionStatus } from './v1submission-status';
import { V1Decimal } from './v1decimal';

/**
 * Submission is a documented expense or income or misc documents with receipts, submitted by a
 * committee member and reviewed by the treasury.
 */
export interface V1Submission {
  committee: string;
  create_time?: string;
  created_by_user?: string;

  /**
   * Time the submission was soft-deleted, if deleted.
   */
  delete_time?: string;

  /**
   * Entity tag for optimistic concurrency control.
   */
  etag?: string;
  income_expense?: V1SubmissionTypeIncomeExpenseDetails;
  misc?: V1SubmissionTypeMiscDetails;
  name?: string;

  /**
   * Free-text notice from the submitter.
   */
  notice?: string;

  /**
   * Human-readable public ID (per-organization yearly sequence, e.g. "2026/04").
   */
  public_id?: string;

  /**
   * Time at which the soft-deleted submission is purged automatically.
   */
  purge_time?: string;

  /**
   * The lifecycle state of the submission.
   */
  status?: V1SubmissionStatus;

  /**
   * Sum of all item amounts (read-only derived value).
   */
  total_amount?: V1Decimal;

  /**
   * The UUID of the submission.
   */
  uid?: string;

  /**
   * Last modification timestamp.
   */
  update_time?: string;
}
