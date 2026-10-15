import { Observable } from 'rxjs';
import { Account, HierarchicalAccount } from '../../../shared/models';

export abstract class AccountListDataService {
  abstract listAccounts(organizationId: string): Observable<HierarchicalAccount[]>;
  abstract createAccount(
    organizationId: string,
    name: string,
    code: string,
    description: string,
    parentAccountId: string | null,
    isContainer: boolean,
    invertSign: boolean,
  ): Observable<Account>;
  abstract archiveAccount(organizationId: string, accountId: string): Observable<void>;
  abstract restoreAccount(organizationId: string, accountId: string): Observable<void>;
}
