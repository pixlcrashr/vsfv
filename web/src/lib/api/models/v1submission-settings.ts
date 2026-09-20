/* tslint:disable */
import { V1Settlement } from './v1settlement';
import { TypeDate } from './type-date';

/**
 * SubmissionSettings hold the per-organization submission configuration.
 */
export interface V1SubmissionSettings {

  /**
   * The settlement kinds enabled for expense submissions in this
   * organization. Defaults to all kinds.
   */
  enabled_settlement_kinds?: Array<V1Settlement>;

  /**
   * Organization-wide submission deadline. Pending submissions are
   * automatically rejected once this date is reached. Unset means no deadline.
   */
  submission_deadline?: TypeDate;
}
