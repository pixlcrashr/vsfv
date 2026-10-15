import { Observable } from 'rxjs';
import { V1LedgerAccountType } from '../../../../lib/api/models/v1ledger-account-type';

export interface LedgerAccountDetail {
  id: string;
  name: string;
  code: string;
  displayName?: string;
  displayDescription?: string;
  type?: V1LedgerAccountType;
  updateTime?: string;
  createTime?: string;
  etag?: string;
}

export interface UpdateLedgerAccountRequest {
  id: string;
  displayName?: string;
  displayDescription?: string;
  type?: V1LedgerAccountType;
  etag?: string;
}

export abstract class LedgerAccountEditDataService {
  abstract getLedgerAccount(organizationId: string, id: string): Observable<LedgerAccountDetail>;
  abstract updateLedgerAccount(
    organizationId: string,
    request: UpdateLedgerAccountRequest
  ): Observable<LedgerAccountDetail>;
}
