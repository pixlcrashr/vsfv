/* tslint:disable */
import { V1BankAccount } from './v1bank-account';

/**
 * SubmissionSettlementPaymentRequest are the settlement details for an expense that the
 * treasury should pay from the central account.
 */
export interface V1SubmissionSettlementPaymentRequest {
  bank_account: V1BankAccount;
}
