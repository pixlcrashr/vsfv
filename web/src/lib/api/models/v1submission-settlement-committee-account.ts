/* tslint:disable */
import { TypeDate } from './type-date';

/**
 * SubmissionSettlementCommitteeAccount are the settlement details for an expense that was
 * already paid from a committee-held payment account.
 */
export interface V1SubmissionSettlementCommitteeAccount {

  /**
   * The date the expense was paid.
   */
  paid_date: TypeDate;
  payment_account: string;

  /**
   * Optional payment reference (e.g. mandate or booking reference).
   */
  payment_reference?: string;
}
