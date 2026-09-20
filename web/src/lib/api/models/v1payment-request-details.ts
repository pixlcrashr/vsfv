/* tslint:disable */
import { V1PaymentRequestTiming } from './v1payment-request-timing';

/**
 * PaymentRequestDetails are the settlement details for an expense that the
 * treasury should pay from the central account.
 */
export interface V1PaymentRequestDetails {

  /**
   * When the treasury should execute the payment.
   */
  timing: V1PaymentRequestTiming;

  /**
   * BIC of the vendor (optional).
   */
  vendor_bic?: string;

  /**
   * IBAN of the vendor.
   */
  vendor_iban: string;

  /**
   * Name of the vendor / payment recipient.
   */
  vendor_name: string;
}
