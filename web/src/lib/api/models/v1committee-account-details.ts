/* tslint:disable */
import { TypeDate } from './type-date';

/**
 * CommitteeAccountDetails are the settlement details for an expense that was
 * already paid from a committee-held payment account.
 */
export interface V1CommitteeAccountDetails {

  /**
   * The date the expense was paid.
   */
  paid_date: TypeDate;

  /**
   * Label of the payment account at the time of submission (snapshot, so
   * historical submissions stay readable if the account is renamed/removed).
   */
  payment_account_label?: string;

  /**
   * The UUID of the committee payment account the expense was paid from
   * (Committee.payment_accounts[].uid).
   */
  payment_account_uid: string;

  /**
   * Optional payment reference (e.g. mandate or booking reference).
   */
  payment_reference?: string;
}
