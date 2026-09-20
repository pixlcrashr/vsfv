/* tslint:disable */
import { V1SubmissionItem } from './v1submission-item';
export interface V1ListSubmissionItemsResponse {

  /**
   * The items returned.
   */
  items?: Array<V1SubmissionItem>;

  /**
   * A token to retrieve the next page of results.
   */
  next_page_token?: string;
}
