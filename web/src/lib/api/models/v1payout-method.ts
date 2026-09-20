/* tslint:disable */

/**
 * PayoutMethod describes how a person settlement payout is executed.
 */
type V1PayoutMethod =
  'PAYOUT_METHOD_UNSPECIFIED' |
  'PAYOUT_METHOD_BANK_TRANSFER' |
  'PAYOUT_METHOD_CASH';
module V1PayoutMethod {
  export const PAYOUT_METHOD_UNSPECIFIED: V1PayoutMethod = 'PAYOUT_METHOD_UNSPECIFIED';
  export const PAYOUT_METHOD_BANK_TRANSFER: V1PayoutMethod = 'PAYOUT_METHOD_BANK_TRANSFER';
  export const PAYOUT_METHOD_CASH: V1PayoutMethod = 'PAYOUT_METHOD_CASH';
  export function values(): V1PayoutMethod[] {
    return [
      PAYOUT_METHOD_UNSPECIFIED,
      PAYOUT_METHOD_BANK_TRANSFER,
      PAYOUT_METHOD_CASH
    ];
  }
}

export { V1PayoutMethod }