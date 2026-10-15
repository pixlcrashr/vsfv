/* tslint:disable */
export interface V1BankAccount {

  /**
   * Name of the account holder.
   */
  account_holder?: string;
  account_number?: string;

  /**
   * BIC of the account (optional).
   */
  bic?: string;

  /**
   * IBAN of the account.
   */
  iban?: string;
}
