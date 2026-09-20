/* tslint:disable */

/**
 * BankDetails are the personal bank account details of the submitting person
 * for a person settlement payout.
 */
export interface V1BankDetails {

  /**
   * Name of the account holder.
   */
  account_holder: string;

  /**
   * BIC of the account (optional).
   */
  bic?: string;

  /**
   * IBAN of the account.
   */
  iban: string;
}
