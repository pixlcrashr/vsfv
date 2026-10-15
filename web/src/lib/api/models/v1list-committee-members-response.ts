/* tslint:disable */
import { V1CommitteeMember } from './v1committee-member';
export interface V1ListCommitteeMembersResponse {

  /**
   * The memberships returned.
   */
  members?: Array<V1CommitteeMember>;

  /**
   * A token to retrieve the next page of results.
   */
  next_page_token?: string;

  /**
   * Total number of memberships matching the filter (may be an estimate).
   */
  total_size?: string;
}
