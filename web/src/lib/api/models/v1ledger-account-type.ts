/* tslint:disable */

/**
 * LedgerAccountType classifies a ledger account for the budget-plan
 * actual-value computation. Unmarked accounts are plain income/expense-side
 * accounts.
 *
 *  - LEDGER_ACCOUNT_TYPE_UNSPECIFIED: Default value. The account carries no special balance role.
 *  - LEDGER_ACCOUNT_TYPE_LIQUIDITY: Liquidity accounts (bank/cash). Value moving to/from them is plan-relevant.
 *  - LEDGER_ACCOUNT_TYPE_COUNTER: Counter accounts (Debitoren, Darlehen, Kreditoren). Value only becomes
 * plan-relevant when booked against an income/expense account.
 *  - LEDGER_ACCOUNT_TYPE_START_ACCOUNT: Opening-balance accounts (Eröffnungsbilanz). Value booked from them
 * represents the carried-over reserve.
 */
type V1LedgerAccountType =
  'LEDGER_ACCOUNT_TYPE_UNSPECIFIED' |
  'LEDGER_ACCOUNT_TYPE_LIQUIDITY' |
  'LEDGER_ACCOUNT_TYPE_COUNTER' |
  'LEDGER_ACCOUNT_TYPE_START_ACCOUNT';
module V1LedgerAccountType {
  export const LEDGER_ACCOUNT_TYPE_UNSPECIFIED: V1LedgerAccountType = 'LEDGER_ACCOUNT_TYPE_UNSPECIFIED';
  export const LEDGER_ACCOUNT_TYPE_LIQUIDITY: V1LedgerAccountType = 'LEDGER_ACCOUNT_TYPE_LIQUIDITY';
  export const LEDGER_ACCOUNT_TYPE_COUNTER: V1LedgerAccountType = 'LEDGER_ACCOUNT_TYPE_COUNTER';
  export const LEDGER_ACCOUNT_TYPE_START_ACCOUNT: V1LedgerAccountType = 'LEDGER_ACCOUNT_TYPE_START_ACCOUNT';
  export function values(): V1LedgerAccountType[] {
    return [
      LEDGER_ACCOUNT_TYPE_UNSPECIFIED,
      LEDGER_ACCOUNT_TYPE_LIQUIDITY,
      LEDGER_ACCOUNT_TYPE_COUNTER,
      LEDGER_ACCOUNT_TYPE_START_ACCOUNT
    ];
  }
}

export { V1LedgerAccountType }