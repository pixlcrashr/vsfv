/* tslint:disable */
import { TypeDate } from './type-date';

/**
 * OrganizationSubmissionSettings hold the per-organization submission configuration.
 */
export interface V1OrganizationSubmissionSettings {

  /**
   * Organization-wide submission deadline. Pending submissions are
   * automatically rejected once this date is reached. Unset means no deadline.
   */
  submission_deadline?: TypeDate;
}
