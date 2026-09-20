/* tslint:disable */
import { V1Committee } from './v1committee';
export interface V1ListCommitteesResponse {

  /**
   * The committees returned.
   */
  committees?: Array<V1Committee>;

  /**
   * A token to retrieve the next page of results.
   */
  next_page_token?: string;

  /**
   * Total number of committees matching the filter (may be an estimate).
   */
  total_size?: string;
}
