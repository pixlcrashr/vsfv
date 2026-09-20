/* tslint:disable */

/**
 * PaymentRequestTiming describes when the treasury should execute a payment
 * request.
 */
type V1PaymentRequestTiming =
  'PAYMENT_REQUEST_TIMING_UNSPECIFIED' |
  'PAYMENT_REQUEST_TIMING_ON_INVOICE' |
  'PAYMENT_REQUEST_TIMING_ADVANCE';
module V1PaymentRequestTiming {
  export const PAYMENT_REQUEST_TIMING_UNSPECIFIED: V1PaymentRequestTiming = 'PAYMENT_REQUEST_TIMING_UNSPECIFIED';
  export const PAYMENT_REQUEST_TIMING_ON_INVOICE: V1PaymentRequestTiming = 'PAYMENT_REQUEST_TIMING_ON_INVOICE';
  export const PAYMENT_REQUEST_TIMING_ADVANCE: V1PaymentRequestTiming = 'PAYMENT_REQUEST_TIMING_ADVANCE';
  export function values(): V1PaymentRequestTiming[] {
    return [
      PAYMENT_REQUEST_TIMING_UNSPECIFIED,
      PAYMENT_REQUEST_TIMING_ON_INVOICE,
      PAYMENT_REQUEST_TIMING_ADVANCE
    ];
  }
}

export { V1PaymentRequestTiming }