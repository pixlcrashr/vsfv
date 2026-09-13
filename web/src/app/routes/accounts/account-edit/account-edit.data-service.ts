import { Observable } from 'rxjs';
import { Account, AuditLogHistoryEntry } from '../../../shared/models';

export interface AccountDetails extends Account {
  createdAt: Date;
  updatedAt: Date;
  depth: number;
  childrenCount: number;
}

export abstract class AccountEditDataService {
  abstract getAccount(organizationId: string, accountId: string): Observable<AccountDetails>;
  abstract updateAccount(
    organizationId: string,
    accountId: string,
    name: string,
    code: string,
    description: string
  ): Observable<AccountDetails>;
  abstract listParentAccounts(organizationId: string): Observable<Account[]>;

  /** Audit log entries for the account. */
  abstract getAuditLog(organizationId: string, accountId: string): Observable<AuditLogHistoryEntry[]>;
}
