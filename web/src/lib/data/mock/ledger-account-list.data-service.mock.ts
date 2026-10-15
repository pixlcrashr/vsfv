import { Observable, of } from 'rxjs';
import {
  LedgerAccountListDataService,
  LedgerAccountListItem,
  LedgerAccountListFilter,
} from '../../../app/routes/ledger/ledger-accounts/ledger-account-list.data-service';
import { faker } from '@faker-js/faker';
import { naturalCompare } from '../../../app/shared/utils/account-sort.utils';

const balanceRoles = [
  'LEDGER_ACCOUNT_TYPE_UNSPECIFIED',
  'LEDGER_ACCOUNT_TYPE_LIQUIDITY',
  'LEDGER_ACCOUNT_TYPE_COUNTER',
  'LEDGER_ACCOUNT_TYPE_START_ACCOUNT',
];

const balanceRoleCodes: Record<string, string[]> = {
  LEDGER_ACCOUNT_TYPE_UNSPECIFIED: ['4000', '4100', '6000', '6100', '6200'],
  LEDGER_ACCOUNT_TYPE_LIQUIDITY: ['1000', '1200', '1400'],
  LEDGER_ACCOUNT_TYPE_COUNTER: ['3300', '3400', '3600'],
  LEDGER_ACCOUNT_TYPE_START_ACCOUNT: ['9000', '9100'],
};

function createMockLedgerAccount(): LedgerAccountListItem {
  const type = faker.helpers.arrayElement(balanceRoles);
  const code = faker.helpers.arrayElement(balanceRoleCodes[type] || ['1000']);
  
  return {
    id: faker.string.uuid(),
    code: code + faker.number.int({ min: 0, max: 99 }).toString().padStart(2, '0'),
    displayName: faker.finance.accountName(),
    displayDescription: faker.datatype.boolean() ? faker.lorem.sentence() : undefined,
    type,
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

    if (filter?.type) {
      filtered = filtered.filter(a => a.type === filter.type);
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
