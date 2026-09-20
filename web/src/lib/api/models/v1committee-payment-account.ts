/* tslint:disable */
import { V1PaymentAccountKind } from './v1payment-account-kind';

/**
 * CommitteePaymentAccount describes a payment account held by a committee
 * (e.g. the committee's own bank account or an independently organized cash
 * box). Committees with at least one payment account may pay expenses from
 * these accounts and submit the bills for documentation.
 */
export interface V1CommitteePaymentAccount {

  /**
   * Human-readable label of the payment account (e.g. "Gremiumskonto").
   */
  display_label: string;

  /**
   * The kind of payment account.
   */
  kind: V1PaymentAccountKind;

  /**
   * The UUID of the payment account. Used by submissions to reference the
   * account they were paid from.
   */
  uid?: string;
}
