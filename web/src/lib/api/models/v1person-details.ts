/* tslint:disable */
import { V1BankDetails } from './v1bank-details';
import { V1PayoutMethod } from './v1payout-method';

/**
 * PersonDetails are the settlement details for a person settlement.
 */
export interface V1PersonDetails {

  /**
   * The bank account for the payout (required for bank transfer payouts).
   */
  bank_details?: V1BankDetails;

  /**
   * How the payout should be executed.
   */
  payout_method: V1PayoutMethod;
}
