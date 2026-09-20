// Committee Model (shared across Applications and Submissions)

import { CommitteePaymentAccount } from './submission.model';

export interface Committee {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  // Whether submitters of this committee may choose between the hoheitlich
  // and gewerblich scope on submission creation. If false, submissions are
  // always hoheitlich.
  allowScopeSelection: boolean;
  // Payment accounts held by the committee (bank account / cash box). Empty
  // means the committee cannot settle from its own account.
  paymentAccounts: CommitteePaymentAccount[];
  createdAt: Date;
  updatedAt: Date;
}
