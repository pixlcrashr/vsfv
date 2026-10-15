import { Observable, of, throwError } from 'rxjs';
import {
  LedgerAccountEditDataService,
  LedgerAccountDetail,
  UpdateLedgerAccountRequest,
} from '../../../app/routes/ledger/ledger-accounts/ledger-account-edit.data-service';
import { V1LedgerAccountType } from '../../api/models/v1ledger-account-type';
import { faker } from '@faker-js/faker';

const mockAccounts: Map<string, LedgerAccountDetail> = new Map();

function createMockAccount(id: string): LedgerAccountDetail {
  const type = faker.helpers.arrayElement<V1LedgerAccountType>([
    'LEDGER_ACCOUNT_TYPE_UNSPECIFIED',
    'LEDGER_ACCOUNT_TYPE_LIQUIDITY',
    'LEDGER_ACCOUNT_TYPE_COUNTER',
    'LEDGER_ACCOUNT_TYPE_START_ACCOUNT',
  ]);

  return {
    id,
    name: `organizations/test/ledgerAccounts/${id}`,
    code: faker.number.int({ min: 1000, max: 9999 }).toString(),
    displayName: faker.finance.accountName(),
    displayDescription: faker.datatype.boolean() ? faker.lorem.sentence() : undefined,
    type,
    updateTime: faker.date.recent().toISOString(),
    createTime: faker.date.past().toISOString(),
    etag: faker.string.alphanumeric(16),
  };
}

export class MockLedgerAccountEditDataService implements LedgerAccountEditDataService {
  getLedgerAccount(_organizationId: string, id: string): Observable<LedgerAccountDetail> {
    if (!mockAccounts.has(id)) {
      mockAccounts.set(id, createMockAccount(id));
    }
    return of(mockAccounts.get(id)!);
  }

  updateLedgerAccount(
    _organizationId: string,
    request: UpdateLedgerAccountRequest
  ): Observable<LedgerAccountDetail> {
    const account = mockAccounts.get(request.id);
    if (!account) {
      return throwError(() => new Error('Account not found'));
    }

    const updated: LedgerAccountDetail = {
      ...account,
      displayName: request.displayName ?? account.displayName,
      displayDescription: request.displayDescription ?? account.displayDescription,
      type: request.type ?? account.type,
      updateTime: new Date().toISOString(),
      etag: faker.string.alphanumeric(16),
    };

    mockAccounts.set(request.id, updated);
    return of(updated);
  }
}
