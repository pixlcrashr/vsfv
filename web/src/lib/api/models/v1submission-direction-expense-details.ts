/* tslint:disable */
import { V1SubmissionSettlementCommitteeAccount } from './v1submission-settlement-committee-account';
import { V1SubmissionSettlementPaymentRequest } from './v1submission-settlement-payment-request';
import { V1SubmissionSettlementPerson } from './v1submission-settlement-person';
export interface V1SubmissionDirectionExpenseDetails {

  /**
   * Details for an already-paid committee account settlement.
   */
  committee_account?: V1SubmissionSettlementCommitteeAccount;

  /**
   * Details for a payment request to the treasury.
   */
  payment_request?: V1SubmissionSettlementPaymentRequest;

  /**
   * Details for a person settlement.
   */
  person?: V1SubmissionSettlementPerson;
}
