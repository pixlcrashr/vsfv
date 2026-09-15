import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AccountServiceService } from '../../api/services/account-service.service';
import { Account, HierarchicalAccount } from '../../../app/shared/models';
import { AccountListDataService } from '../../../app/routes/accounts/account-list/account-list.data-service';
import { mapApiAccount, mapApiNestedAccount } from './_mappers';
import { sortAccountTreeByCode } from '../../../app/shared/utils/account-sort.utils';

@Injectable()
export class HttpAccountListDataService extends AccountListDataService {
  private readonly svc = inject(AccountServiceService);
  private orgParent(organizationId: string): string {
    return `organizations/${organizationId}`;
  }

  private accountName(organizationId: string, uid: string): string {
    return `${this.orgParent(organizationId)}/accounts/${uid}`;
  }

  listAccounts(organizationId: string): Observable<HierarchicalAccount[]> {
    const parent = this.orgParent(organizationId);
    return this.svc.AccountServiceListNestedAccounts({ parent }).pipe(
      map((resp) => sortAccountTreeByCode((resp.accounts ?? []).map((n) => mapApiNestedAccount(n)))),
    );
  }

  createAccount(
    organizationId: string,
    name: string,
    code: string,
    description: string,
    parentAccountId: string | null,
    isContainer: boolean,
  ): Observable<Account> {
    const parentAccount = parentAccountId ? this.accountName(organizationId, parentAccountId) : undefined;
    return this.svc.AccountServiceCreateAccount({
      parent: this.orgParent(organizationId),
      account: {
        display_name: name,
        display_code: code,
        display_description: description,
        parent_account: parentAccount,
        is_container: isContainer,
      },
    }).pipe(map(mapApiAccount));
  }

  archiveAccount(organizationId: string, id: string): Observable<void> {
    return this.svc.AccountServiceArchiveAccount({ name: this.accountName(organizationId, id), body: {} }).pipe(map(() => undefined));
  }

  restoreAccount(organizationId: string, id: string): Observable<void> {
    return this.svc.AccountServiceRestoreAccount({ name: this.accountName(organizationId, id), body: {} }).pipe(map(() => undefined));
  }
}
