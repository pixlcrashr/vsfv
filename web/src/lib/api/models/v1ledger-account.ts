/* tslint:disable */
import { V1LedgerAccountType } from './v1ledger-account-type';

/**
 * LedgerAccount represents an account from a "Kontenrahmen" used for bookkeeping.
 * Accounts are automatically created during data import but can be edited afterwards.
 */
export interface V1LedgerAccount {

  /**
   * Unique account code (e.g., from the Kontenrahmen).
   */
  code?: string;

  /**
   * Creation timestamp.
   */
  create_time?: string;

  /**
   * Optional free-text description.
   */
  display_description?: string;

  /**
   * Human-readable name.
   */
  display_name?: string;

  /**
   * Entity tag for optimistic concurrency control.
   */
  etag?: string;
  name?: string;

  /**
   * The type of the account for budget-plan value interpretation.
   */
  type?: V1LedgerAccountType;

  /**
   * The UUID of the ledger account.
   */
  uid?: string;

  /**
   * Last modification timestamp.
   */
  update_time?: string;
}
