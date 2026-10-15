import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  LedgerAccountEditDataService,
  LedgerAccountDetail,
  UpdateLedgerAccountRequest,
} from '../../../app/routes/ledger/ledger-accounts/ledger-account-edit.data-service';
import { LedgerAccountServiceService } from '../../api/services/ledger-account-service.service';
import { V1LedgerAccountType } from '../../api/models/v1ledger-account-type';

@Injectable({ providedIn: 'root' })
export class HttpLedgerAccountEditDataService implements LedgerAccountEditDataService {
  constructor(private readonly api: LedgerAccountServiceService) {}

  getLedgerAccount(organizationId: string, id: string): Observable<LedgerAccountDetail> {
    const name = `organizations/${organizationId}/ledgerAccounts/${id}`;
    return this.api.LedgerAccountServiceGetLedgerAccount(name).pipe(
      map((account) => ({
        id: account.uid || '',
        name: account.name || '',
        code: account.code ?? '',
        displayName: account.display_name,
        displayDescription: account.display_description,
        type: (account.type ?? 'LEDGER_ACCOUNT_TYPE_UNSPECIFIED') as V1LedgerAccountType,
        updateTime: account.update_time,
        createTime: account.create_time,
        etag: account.etag,
      }))
    );
  }

  updateLedgerAccount(
    organizationId: string,
    request: UpdateLedgerAccountRequest
  ): Observable<LedgerAccountDetail> {
    const ledgerAccountName = `organizations/${organizationId}/ledgerAccounts/${request.id}`;

    // The code is output-only and never sent; the server applies the update
    // mask (type, display_name, display_description).
    return this.api
      .LedgerAccountServiceUpdateLedgerAccount({
        ledgerAccountName,
        ledgerAccount: {
          uid: request.id,
          type: (request.type ?? 'LEDGER_ACCOUNT_TYPE_UNSPECIFIED') as V1LedgerAccountType,
          display_name: request.displayName,
          display_description: request.displayDescription,
          etag: request.etag,
        },
      })
      .pipe(
        map((account) => ({
          id: account.uid || '',
          name: account.name || '',
          code: account.code ?? '',
          displayName: account.display_name,
          displayDescription: account.display_description,
          type: (account.type ?? 'LEDGER_ACCOUNT_TYPE_UNSPECIFIED') as V1LedgerAccountType,
          updateTime: account.update_time,
          createTime: account.create_time,
          etag: account.etag,
        }))
      );
  }
}
