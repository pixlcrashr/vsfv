/* tslint:disable */
import { V1Submission } from './v1submission';
export interface V1ListSubmissionsResponse {

  /**
   * A token to retrieve the next page of results.
   */
  next_page_token?: string;

  /**
   * The submissions returned.
   */
  submissions?: Array<V1Submission>;

  /**
   * Total number of submissions matching the filter (may be an estimate).
   */
  total_size?: string;
}
