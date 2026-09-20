/* tslint:disable */
import { V1Decimal } from './v1decimal';
import { V1DocumentForm } from './v1document-form';

/**
 * SubmissionItem is a single bill/receipt (expense) or income document within
 * a submission.
 */
export interface V1SubmissionItem {

  /**
   * Amount of the item.
   */
  amount: V1Decimal;

  /**
   * Document category. Free-form to keep the API generalization-friendly;
   * clients present per-direction presets (expenses: invoice, cash receipt,
   * ...; income: donation receipt, sponsorship agreement, ...).
   */
  category?: string;

  /**
   * Free-text description of the document.
   */
  description?: string;

  /**
   * In which form the original document exists.
   */
  document_form?: V1DocumentForm;
  name?: string;

  /**
   * Time the original document was received by the treasury.
   */
  original_receive_time?: string;
  original_received_by?: string;

  /**
   * Human-readable public ID derived from the submission's public ID and the
   * item index (e.g. "2026/04/2").
   */
  public_id?: string;

  /**
   * Origin/source of an income (e.g. sponsor name). Only used by income
   * submissions.
   */
  source?: string;

  /**
   * The UUID of the item.
   */
  uid?: string;
}
