/* tslint:disable */
import { V1SubmissionPayoutMethodBankTransfer } from './v1submission-payout-method-bank-transfer';
import { V1SubmissionPayoutMethodCash } from './v1submission-payout-method-cash';

/**
 * SubmissionSettlementPerson are the settlement details for a person settlement.
 */
export interface V1SubmissionSettlementPerson {
  bank_transfer?: V1SubmissionPayoutMethodBankTransfer;
  cash?: V1SubmissionPayoutMethodCash;
}
