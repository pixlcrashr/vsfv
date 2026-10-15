/* tslint:disable */

/**
 * Committee is an organizational unit (e.g. a student committee) that submits
 * expense submissions and income documents.
 */
export interface V1Committee {

  /**
   * Whether submitters of this committee may choose between the nonprofit and
   * commercial scope when creating submissions. If false, submissions of this
   * committee are always created with the nonprofit scope.
   */
  allow_scope_selection?: boolean;

  /**
   * Creation timestamp.
   */
  create_time?: string;

  /**
   * Optional free-text description.
   */
  display_description?: string;

  /**
   * Human-readable committee name.
   */
  display_name: string;

  /**
   * Whether the committee is referenced by other resources (currently
   * submissions, including soft-deleted ones). A referenced committee cannot
   * be deleted; DeleteCommittee fails with FAILED_PRECONDITION. Clients can
   * use this to disable delete actions.
   */
  is_referenced?: boolean;
  name?: string;

  /**
   * The UUID of the committee.
   */
  uid?: string;

  /**
   * Last modification timestamp.
   */
  update_time?: string;
}
