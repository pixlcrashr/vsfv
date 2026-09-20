/* tslint:disable */
import { V1CommitteeAccountDetails } from './v1committee-account-details';
import { V1Direction } from './v1direction';
import { V1PaymentRequestDetails } from './v1payment-request-details';
import { V1PersonDetails } from './v1person-details';
import { V1Scope } from './v1scope';
import { V1Settlement } from './v1settlement';
import { V1SubmissionStatus } from './v1submission-status';
import { V1Decimal } from './v1decimal';

/**
 * Submission is a documented expense or income with receipts, submitted by a
 * committee member and reviewed by the treasury.
 */
export interface V1Submission {
  committee: string;

  /**
   * Details for an already-paid committee account settlement.
   */
  committee_account_details?: V1CommitteeAccountDetails;

  /**
   * Creation timestamp.
   */
  create_time?: string;
  created_by_user?: string;

  /**
   * Time the submission was soft-deleted, if deleted.
   */
  delete_time?: string;

  /**
   * Whether this submission documents an expense or an income.
   */
  direction: V1Direction;

  /**
   * Entity tag for optimistic concurrency control.
   */
  etag?: string;
  name?: string;

  /**
   * Free-text notice from the submitter.
   */
  notice?: string;

  /**
   * Details for a payment request to the treasury.
   */
  payment_request_details?: V1PaymentRequestDetails;

  /**
   * Details for a person settlement.
   */
  person_details?: V1PersonDetails;

  /**
   * Human-readable public ID (per-organization yearly sequence, e.g. "2026/04").
   */
  public_id?: string;

  /**
   * Time at which the soft-deleted submission is purged automatically.
   */
  purge_time?: string;

  /**
   * The nonprofit/commercial scope of the submission.
   */
  scope: V1Scope;

  /**
   * How the expense is settled. Must be unset for income submissions.
   */
  settlement?: V1Settlement;

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
