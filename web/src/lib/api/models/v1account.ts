/* tslint:disable */

/**
 * Account represents a budget account in the chart of accounts.
 */
export interface V1Account {

  /**
   * Creation timestamp.
   */
  create_time?: string;

  /**
   * Short account code.
   */
  display_code: string;

  /**
   * Optional free-text description.
   */
  display_description?: string;

  /**
   * The full account code: the account's display_code concatenated with the
   * display_code of each ancestor, separated by "-", ordered from the root
   * ancestor down to the account itself. Example: "A-1-2-3-4".
   */
  display_full_code?: string;

  /**
   * The full account name: the account's display_name concatenated with the
   * display_name of each ancestor, separated by " / ", ordered from the root
   * ancestor down to the account itself. Example: "Root / Child / Grandchild".
   */
  display_full_name?: string;

  /**
   * Human-readable account name.
   */
  display_name: string;

  /**
   * Entity tag for optimistic concurrency control.
   */
  etag?: string;

  /**
   * Whether the account is archived (soft-deleted).
   */
  is_archived?: boolean;

  /**
   * Whether this account is a container account (cannot hold values directly).
   * Immutable after creation.
   */
  is_container?: boolean;
  name?: string;
  parent_account?: string;

  /**
   * The UUID of the account.
   */
  uid?: string;

  /**
   * Last modification timestamp.
   */
  update_time?: string;
}
