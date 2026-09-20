/* tslint:disable */
import { V1SubmissionStatus } from './v1submission-status';

/**
 * SubmissionStatusChange describes a status transition associated with a
 * comment.
 */
export interface V1SubmissionStatusChange {

  /**
   * The status before the transition.
   */
  from?: V1SubmissionStatus;

  /**
   * The status after the transition.
   */
  to?: V1SubmissionStatus;
}
