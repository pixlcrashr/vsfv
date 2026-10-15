/* tslint:disable */
import { V1Committee } from './v1committee';
export interface V1ListUserCommitteesResponse {

  /**
   * The committees the user is a member of.
   */
  committees?: Array<V1Committee>;

  /**
   * A token to retrieve the next page of results.
   */
  next_page_token?: string;

  /**
   * Total number of committees the user is a member of.
   */
  total_size?: string;
}
