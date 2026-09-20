/* tslint:disable */
import { V1CommitteePaymentAccount } from './v1committee-payment-account';

/**
 * Committee is an organizational unit (e.g. a student committee) that submits
 * expense submissions and income documents.
 */
export interface V1Committee {

  /**
   * Whether submitters of this committee may choose between the nonprofit and
   * commercial scope when creating submissions. If false, submissions of this
   * committee are always created with the nonprofit scope.
   */
  allow_scope_selection?: boolean;

  /**
   * Creation timestamp.
   */
  create_time?: string;

  /**
   * Optional free-text description.
   */
  display_description?: string;

  /**
   * Human-readable committee name.
   */
  display_name: string;
  name?: string;

  /**
   * Payment accounts held by this committee. If empty, committee members
   * cannot pay from a committee account and must use the person settlement.
   */
  payment_accounts?: Array<V1CommitteePaymentAccount>;

  /**
   * The UUID of the committee.
   */
  uid?: string;

  /**
   * Last modification timestamp.
   */
  update_time?: string;
}
