/* tslint:disable */
import { V1Month } from './v1month';
import { V1SubmissionSettings } from './v1submission-settings';

/**
 * Organization is the top-level resource that owns all other resources.
 */
export interface V1Organization {

  /**
   * Creation timestamp.
   */
  create_time?: string;

  /**
   * Optional free-text description.
   */
  display_description?: string;

  /**
   * Human-readable organization name.
   */
  display_name: string;

  /**
   * Entity tag for optimistic concurrency control.
   */
  etag?: string;
  name?: string;

  /**
   * The start month of ledger years for this organization. It is assumed that the start date is the 1st of the month.
   */
  start_month: V1Month;

  /**
   * Submission settings for this organization.
   */
  submission_settings?: V1SubmissionSettings;

  /**
   * The UUID of the organization.
   */
  uid?: string;

  /**
   * Last modification timestamp.
   */
  update_time?: string;
}
