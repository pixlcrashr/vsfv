/* tslint:disable */
import { V1SubmissionComment } from './v1submission-comment';
export interface V1ListSubmissionCommentsResponse {

  /**
   * The comments returned (admin-only comments are omitted for requesters
   * without the treasury comment permission).
   */
  comments?: Array<V1SubmissionComment>;

  /**
   * A token to retrieve the next page of results.
   */
  next_page_token?: string;
}
