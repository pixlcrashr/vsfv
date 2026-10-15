/* tslint:disable */
import { V1CommitteePaymentAccount } from './v1committee-payment-account';
export interface V1ListCommitteePaymentAccountsResponse {

  /**
   * A token to retrieve the next page of results.
   */
  next_page_token?: string;

  /**
   * The payment accounts returned.
   */
  payment_accounts?: Array<V1CommitteePaymentAccount>;

  /**
   * Total number of payment accounts of the committee (may be an estimate).
   */
  total_size?: string;
}
