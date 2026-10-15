import { Injectable } from '@angular/core';
import { EMPTY, Observable, expand, map, toArray } from 'rxjs';
import {
  LedgerAccountListDataService,
  LedgerAccountListItem,
  LedgerAccountListFilter,
} from '../../../app/routes/ledger/ledger-accounts/ledger-account-list.data-service';
import { LedgerAccountServiceService } from '../../api/services/ledger-account-service.service';
import { V1LedgerAccountType } from '../../api/models/v1ledger-account-type';
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
    const pageSize = 100; // server maximum; anything larger is clamped

    const filterParts: string[] = [];
    if (filter?.type) {
      filterParts.push(`type=${filter.type}`);
    }
    if (filter?.search) {
      filterParts.push(`code:"${filter.search}"`);
    }
    const filterString = filterParts.length > 0 ? filterParts.join(' AND ') : undefined;

    return this.api
      .LedgerAccountServiceListLedgerAccounts({
        parent,
        pageToken,
        pageSize,
        filter: filterString,
        orderBy: 'code',
      })
      .pipe(
        expand((response) => {
          const next = response.next_page_token;
          if (!next) {
            return EMPTY;
          }
          return this.api.LedgerAccountServiceListLedgerAccounts({
            parent,
            pageToken: next,
            pageSize,
            filter: filterString,
            orderBy: 'code',
          });
        }),
        map((response) => response.ledger_accounts ?? []),
        toArray(),
        map((pages) => ({
          accounts: pages
            .flat()
            .map((account) => ({
              id: account.uid || '',
              code: account.code ?? '',
              displayName: account.display_name || '',
              displayDescription: account.display_description,
              type: (account.type ?? 'LEDGER_ACCOUNT_TYPE_UNSPECIFIED') as V1LedgerAccountType,
              updateTime: account.update_time,
            }))
            .sort((a, b) => naturalCompare(a.code, b.code)),
          // The full list is assembled here, so no further pages remain.
          totalSize: pages.flat().length,
        }))
      );
  }
}
