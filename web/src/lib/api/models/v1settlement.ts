/* tslint:disable */

/**
 * Settlement describes how an expense submission is (or was) settled.
 *
 *  - SETTLEMENT_PERSON: The submitter paid privately and receives a payout.
 *  - SETTLEMENT_COMMITTEE_ACCOUNT: The expense was already paid from a committee-held payment account
 * (bank account or cash box); the submission is documentation only.
 *  - SETTLEMENT_PAYMENT_REQUEST: The expense is not yet paid; the treasury pays the vendor from the
 * central account.
 */
type V1Settlement =
  'SETTLEMENT_UNSPECIFIED' |
  'SETTLEMENT_PERSON' |
  'SETTLEMENT_COMMITTEE_ACCOUNT' |
  'SETTLEMENT_PAYMENT_REQUEST';
module V1Settlement {
  export const SETTLEMENT_UNSPECIFIED: V1Settlement = 'SETTLEMENT_UNSPECIFIED';
  export const SETTLEMENT_PERSON: V1Settlement = 'SETTLEMENT_PERSON';
  export const SETTLEMENT_COMMITTEE_ACCOUNT: V1Settlement = 'SETTLEMENT_COMMITTEE_ACCOUNT';
  export const SETTLEMENT_PAYMENT_REQUEST: V1Settlement = 'SETTLEMENT_PAYMENT_REQUEST';
  export function values(): V1Settlement[] {
    return [
      SETTLEMENT_UNSPECIFIED,
      SETTLEMENT_PERSON,
      SETTLEMENT_COMMITTEE_ACCOUNT,
      SETTLEMENT_PAYMENT_REQUEST
    ];
  }
}

export { V1Settlement }