import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  LedgerAccountListDataService,
  LedgerAccountListItem,
  LedgerAccountListFilter,
} from '../../../app/routes/ledger/ledger-accounts/ledger-account-list.data-service';
import { LedgerAccountServiceService } from '../../api/services/ledger-account-service.service';
import { naturalCompare } from '../../../app/shared/utils/account-sort.utils';

@Injectable({ providedIn: 'root' })
export class HttpLedgerAccountListDataService implements LedgerAccountListDataService {
  constructor(private readonly api: LedgerAccountServiceService) {}

  listLedgerAccounts(
    organizationId: string,
    filter?: LedgerAccountListFilter,
    pageToken?: string
  ): Observable<{ accounts: LedgerAccountListItem[]; nextPageToken?: string; totalSize: number }> {
    const parent = `organizations/${organizationId}`;

    const filterParts: string[] = [];
    if (filter?.accountType) {
      filterParts.push(`account_type=${filter.accountType}`);
    }
    if (filter?.search) {
      filterParts.push(`code:"${filter.search}"`);
    }

    return this.api
      .LedgerAccountServiceListLedgerAccounts({
        parent,
        pageToken,
        pageSize: 50,
        filter: filterParts.length > 0 ? filterParts.join(' AND ') : undefined,
        orderBy: 'code',
      })
      .pipe(
        map((response) => ({
          accounts:
            response.ledger_accounts?.map((account) => ({
              id: account.uid || '',
              code: account.code,
              displayName: account.display_name || '',
              displayDescription: account.display_description,
              accountType: account.account_type,
              updateTime: account.update_time,
            })) || [],
          nextPageToken: response.next_page_token,
          totalSize: Number(response.total_size) || 0,
        })),
        // The server's order_by is a plain string sort; order the page
        // naturally (1, 2, 10) for display.
        map((result) => ({
          ...result,
          accounts: result.accounts.sort((a, b) => naturalCompare(a.code, b.code)),
        }))
      );
  }
}
