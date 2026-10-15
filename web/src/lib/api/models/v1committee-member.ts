/* tslint:disable */

/**
 * CommitteeMember assigns a user to a committee. Members of a committee may
 * create submissions on behalf of the committee.
 */
export interface V1CommitteeMember {
  committee?: string;

  /**
   * Creation timestamp.
   */
  create_time?: string;
  name?: string;

  /**
   * The UUID of the membership.
   */
  uid?: string;
  user: string;

  /**
   * Display name of the assigned user. Denormalized for display purposes.
   */
  user_display_name?: string;

  /**
   * E-mail address of the assigned user. Denormalized for display purposes.
   */
  user_email?: string;
}
