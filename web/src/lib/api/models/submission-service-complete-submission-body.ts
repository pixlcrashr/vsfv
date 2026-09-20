/* tslint:disable */
import { TypeDate } from './type-date';
export interface SubmissionServiceCompleteSubmissionBody {

  /**
   * The date the payout/payment was executed (if already known).
   */
  paid_date?: TypeDate;

  /**
   * Optional payment reference recorded with the completion.
   */
  payment_reference?: string;
}
