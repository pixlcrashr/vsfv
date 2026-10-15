/* tslint:disable */
import { V1Decimal } from './v1decimal';

/**
 * Transaction represents a financial transaction between two transaction accounts.
 */
export interface V1Transaction {

  /**
   * Transaction amount.
   */
  amount: V1Decimal;

  /**
   * Booking date.
   */
  booked_at: string;

  /**
   * Creation timestamp.
   */
  create_time?: string;
  credit_ledger_account: string;
  debit_ledger_account: string;

  /**
   * Human-readable transaction description. Immutable after creation;
   * UpdateTransaction rejects update masks that include this field.
   */
  description?: string;

  /**
   * Document date.
   */
  document_date: string;

  /**
   * Optional document ID.
   */
  document_id?: string;

  /**
   * Entity tag for optimistic concurrency control.
   */
  etag?: string;
  name?: string;

  /**
   * External reference identifier.
   */
  reference?: string;

  /**
   * The UUID of the transaction.
   */
  uid?: string;

  /**
   * Last modification timestamp.
   */
  update_time?: string;
}
