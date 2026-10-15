/* tslint:disable */
import { V1BankAccount } from './v1bank-account';
export interface V1SubmissionPayoutMethodBankTransfer {

  /**
   * The bank account for the payout (required for bank transfer payouts).
   */
  bank_account?: V1BankAccount;
}
