/* tslint:disable */

/**
 * PaymentAccountKind describes the kind of payment account held by a committee.
 */
type V1PaymentAccountKind =
  'PAYMENT_ACCOUNT_KIND_UNSPECIFIED' |
  'PAYMENT_ACCOUNT_KIND_BANK_ACCOUNT' |
  'PAYMENT_ACCOUNT_KIND_CASH_BOX';
module V1PaymentAccountKind {
  export const PAYMENT_ACCOUNT_KIND_UNSPECIFIED: V1PaymentAccountKind = 'PAYMENT_ACCOUNT_KIND_UNSPECIFIED';
  export const PAYMENT_ACCOUNT_KIND_BANK_ACCOUNT: V1PaymentAccountKind = 'PAYMENT_ACCOUNT_KIND_BANK_ACCOUNT';
  export const PAYMENT_ACCOUNT_KIND_CASH_BOX: V1PaymentAccountKind = 'PAYMENT_ACCOUNT_KIND_CASH_BOX';
  export function values(): V1PaymentAccountKind[] {
    return [
      PAYMENT_ACCOUNT_KIND_UNSPECIFIED,
      PAYMENT_ACCOUNT_KIND_BANK_ACCOUNT,
      PAYMENT_ACCOUNT_KIND_CASH_BOX
    ];
  }
}

export { V1PaymentAccountKind }