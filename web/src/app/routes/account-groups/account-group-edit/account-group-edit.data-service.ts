import { Observable } from 'rxjs';
import {
  AccountGroup,
  AccountGroupAssignment,
  AccountGroupOperation,
  Account,
  AuditLogHistoryEntry,
} from '../../../shared/models';

export interface AccountWithOperation {
  account: Account;
  assignment: AccountGroupAssignment | null;
}

export interface AccountGroupDetails extends AccountGroup {
  assignments: AccountGroupAssignment[];
}

export abstract class AccountGroupEditDataService {
  abstract getGroup(organizationId: string, id: string): Observable<AccountGroupDetails>;
  abstract updateGroup(organizationId: string, id: string, name: string, description: string): Observable<AccountGroupDetails>;
  abstract getAllAccountsWithOperations(organizationId: string, accountGroupId: string): Observable<AccountWithOperation[]>;

  /**
   * Sets the operation of one account within a group: 'I' removes the
   * assignment, 'A'/'S' create or update it (negate = 'S').
   * Returns the resulting assignment id, or null when the assignment was
   * removed.
   */
  abstract updateAccountOperation(
    organizationId: string,
    accountGroupId: string,
    accountId: string,
    operation: AccountGroupOperation,
    assignmentId?: string | null,
  ): Observable<string | null>;
  abstract deleteGroup(organizationId: string, id: string): Observable<void>;

  /** Audit log entries for the account group, including its assignments. */
  abstract getAuditLog(organizationId: string, accountGroupId: string): Observable<AuditLogHistoryEntry[]>;
}
