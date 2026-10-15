import { CommitteePaymentAccountKind } from '../../shared/models';

// Input for creating or updating a committee. `uid` on a payment account is
// empty for new accounts; existing accounts keep their uid so submission
// references to the account stay valid.
export interface PaymentAccountInput {
  uid: string;
  kind: CommitteePaymentAccountKind;
  label: string;
}

export interface SaveCommitteeInput {
  name: string;
  description: string;
  allowScopeSelection: boolean;
  paymentAccounts: PaymentAccountInput[];
}

// A user assigned to a committee.
export interface CommitteeMember {
  id: string;
  // The uid of the assigned user.
  user: string;
  userName: string;
  userEmail: string;
}

// A user that can be assigned to a committee.
export interface CommitteeUser {
  id: string;
  displayName: string;
  email: string;
}
