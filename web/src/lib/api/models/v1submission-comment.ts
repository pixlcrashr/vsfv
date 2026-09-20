/* tslint:disable */
import { V1SubmissionStatusChange } from './v1submission-status-change';

/**
 * SubmissionComment is a comment on a submission, written either by the
 * submitter or by the reviewing treasury. Admin-only comments are only
 * visible to the treasury.
 */
export interface V1SubmissionComment {

  /**
   * The comment text.
   */
  content: string;

  /**
   * Creation timestamp.
   */
  create_time?: string;
  created_by_user?: string;

  /**
   * Whether the comment is only visible to the treasury. Can only be set by
   * users holding the treasury comment permission.
   */
  is_admin_only?: boolean;
  name?: string;

  /**
   * The status change caused by this comment, if any (e.g. a rejection).
   */
  status_change?: V1SubmissionStatusChange;

  /**
   * The UUID of the comment.
   */
  uid?: string;
}
