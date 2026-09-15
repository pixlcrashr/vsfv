import { Observable, of } from 'rxjs';
import {
  LedgerAccountListDataService,
  LedgerAccountListItem,
  LedgerAccountListFilter,
} from '../../../app/routes/ledger/ledger-accounts/ledger-account-list.data-service';
import { faker } from '@faker-js/faker';
import { naturalCompare } from '../../../app/shared/utils/account-sort.utils';

const accountTypes = [
  'ACCOUNT_TYPE_ASSET',
  'ACCOUNT_TYPE_LIABILITY',
  'ACCOUNT_TYPE_EQUITY',
  'ACCOUNT_TYPE_REVENUE',
  'ACCOUNT_TYPE_EXPENSE',
];

const accountTypeCodes: Record<string, string[]> = {
  ACCOUNT_TYPE_ASSET: ['1000', '1200', '1400', '1500', '1600'],
  ACCOUNT_TYPE_LIABILITY: ['3000', '3200', '3300', '3400'],
  ACCOUNT_TYPE_EQUITY: ['9000', '9100', '9200'],
  ACCOUNT_TYPE_REVENUE: ['7000', '7100', '7200', '7300'],
  ACCOUNT_TYPE_EXPENSE: ['6000', '6100', '6200', '6300'],
};

function createMockLedgerAccount(): LedgerAccountListItem {
  const type = faker.helpers.arrayElement(accountTypes);
  const code = faker.helpers.arrayElement(accountTypeCodes[type] || ['1000']);
  
  return {
    id: faker.string.uuid(),
    code: code + faker.number.int({ min: 0, max: 99 }).toString().padStart(2, '0'),
    displayName: faker.finance.accountName(),
    displayDescription: faker.datatype.boolean() ? faker.lorem.sentence() : undefined,
    accountType: type,
    updateTime: faker.date.recent().toISOString(),
  };
}

export class MockLedgerAccountListDataService implements LedgerAccountListDataService {
  private accounts: LedgerAccountListItem[] = [];

  constructor() {
    // Generate mock data
    for (let i = 0; i < 25; i++) {
      this.accounts.push(createMockLedgerAccount());
    }
    // Sort by code
    this.accounts.sort((a, b) => naturalCompare(a.code, b.code));
  }

  listLedgerAccounts(
    _organizationId: string,
    filter?: LedgerAccountListFilter,
    _pageToken?: string
  ): Observable<{ accounts: LedgerAccountListItem[]; nextPageToken?: string; totalSize: number }> {
    let filtered = [...this.accounts];

    if (filter?.accountType) {
      filtered = filtered.filter(a => a.accountType === filter.accountType);
    }

    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(
        a => 
          a.code.toLowerCase().includes(searchLower) ||
          (a.displayName?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    return of({
      accounts: filtered,
      totalSize: filtered.length,
    });
  }
}
