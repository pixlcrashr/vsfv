import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AccountServiceService } from '../../api/services/account-service.service';
import { CreateAccountDialogDataService } from '../../../app/shared/dialogs/create-account-dialog/create-account-dialog.data-service';
import {
  CreatedAccount,
  ParentAccountOption,
} from '../../../app/shared/dialogs/create-account-dialog/create-account-dialog.component';
import { naturalCompare } from '../../../app/shared/utils/account-sort.utils';

interface FlatAccount {
  id: string;
  code: string;
  name: string;
  parentAccountId: string | null;
}

@Injectable()
export class HttpCreateAccountDialogDataService extends CreateAccountDialogDataService {
  private readonly svc = inject(AccountServiceService);

  listParentAccounts(organizationId: string): Observable<ParentAccountOption[]> {
    return this.svc.AccountServiceListAccounts({ parent: `organizations/${organizationId}`, pageSize: 1000, showDeleted: false }).pipe(
      map((response) => {
        const flat: FlatAccount[] = (response.accounts ?? [])
          .filter((a) => a.is_container === true)
          .map((a) => ({
            id: a.uid ?? '',
            code: a.display_code,
            name: a.display_name,
            parentAccountId: a.parent_account ? a.parent_account.split('/').pop() ?? null : null,
          }));
        return this.buildHierarchicalList(flat);
      }),
    );
  }

  private buildHierarchicalList(flat: FlatAccount[]): ParentAccountOption[] {
    const childrenMap = new Map<string | null, FlatAccount[]>();
    for (const a of flat) {
      const key = a.parentAccountId;
      if (!childrenMap.has(key)) childrenMap.set(key, []);
      childrenMap.get(key)!.push(a);
    }

    for (const siblings of childrenMap.values()) {
      siblings.sort((a, b) => naturalCompare(a.code, b.code));
    }

    const result: ParentAccountOption[] = [];
    const traverse = (parentId: string | null, depth: number) => {
      const children = childrenMap.get(parentId) ?? [];
      for (const child of children) {
        result.push({ id: child.id, code: child.code, name: child.name, depth });
        traverse(child.id, depth + 1);
      }
    };
    traverse(null, 0);
    return result;
  }

  createAccount(
    organizationId: string,
    name: string,
    code: string,
    description: string,
    parentAccountId: string | null,
    isContainer: boolean,
  ): Observable<CreatedAccount> {
    const parent = `organizations/${organizationId}`;
    const parentAccount = parentAccountId ? `${parent}/accounts/${parentAccountId}` : undefined;
    return this.svc.AccountServiceCreateAccount({
      parent,
      account: { display_name: name, display_code: code, display_description: description, parent_account: parentAccount, is_container: isContainer },
    }).pipe(
      map((a) => ({
        id: a.uid ?? '',
        code: a.display_code,
        name: a.display_name,
        description: a.display_description ?? '',
        parentAccountId: a.parent_account ? a.parent_account.split('/').pop() ?? null : null,
      })),
    );
  }
}
