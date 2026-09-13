import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { faker } from '@faker-js/faker';
import { Account, AuditLogHistoryEntry } from '../../../app/shared/models';
import {
  AccountEditDataService,
  AccountDetails,
} from '../../../app/routes/accounts/account-edit/account-edit.data-service';
import { MockAuditHistory } from './_shared-audit-history';

@Injectable()
export class MockAccountEditDataService extends AccountEditDataService {
  private accounts: AccountDetails[] = this.generateAccounts();
  private readonly auditHistory = new MockAuditHistory();

  private accountResource(organizationId: string, id: string): string {
    return `organizations/${organizationId}/accounts/${id}`;
  }

  getAccount(organizationId: string, id: string): Observable<AccountDetails> {
    const account = this.accounts.find((a) => a.id === id) || this.accounts[0];
    return of(account).pipe(delay(300));
  }

  updateAccount(
    organizationId: string,
    id: string,
    name: string,
    code: string,
    description: string
  ): Observable<AccountDetails> {
    const account = this.accounts.find((a) => a.id === id);
    if (account) {
      const changes: Array<{ field: string; oldValue?: string; newValue?: string }> = [];
      if (account.name !== name) {
        changes.push({ field: 'display_name', oldValue: account.name, newValue: name });
      }
      if (account.code !== code) {
        changes.push({ field: 'display_code', oldValue: account.code, newValue: code });
      }
      if (account.description !== description) {
        changes.push({ field: 'display_description', oldValue: account.description, newValue: description });
      }
      if (changes.length > 0) {
        this.auditHistory.record(this.accountResource(organizationId, id), 'UPDATE', changes);
      }

      account.name = name;
      account.code = code;
      account.description = description;
      account.updatedAt = new Date();
    }
    return of(account || this.accounts[0]).pipe(delay(300));
  }

  listParentAccounts(organizationId: string): Observable<Account[]> {
    return of(this.accounts.filter((a) => !a.parentAccountId)).pipe(delay(200));
  }

  getAuditLog(organizationId: string, accountId: string): Observable<AuditLogHistoryEntry[]> {
    return of(this.auditHistory.list(this.accountResource(organizationId, accountId))).pipe(delay(300));
  }

  private generateAccounts(): AccountDetails[] {
    const now = new Date();
    return [
      {
        id: faker.string.uuid(),
        code: '1',
        fullCode: '1',
        name: 'Einnahmen',
        description: 'Alle Einnahmen',
        depth: 0,
        childrenCount: 1,
        isArchived: false,
        parentAccountId: null,
        createdAt: new Date(now.getFullYear() - 1, 0, 1),
        updatedAt: now,
      },
      {
        id: faker.string.uuid(),
        code: '1.1',
        fullCode: '1-1.1',
        name: 'Mitgliedsbeiträge',
        description: 'Einnahmen aus Mitgliedsbeiträgen',
        depth: 1,
        childrenCount: 0,
        isArchived: false,
        parentAccountId: null,
        createdAt: new Date(now.getFullYear() - 1, 0, 1),
        updatedAt: now,
      },
      {
        id: faker.string.uuid(),
        code: '2',
        fullCode: '2',
        name: 'Ausgaben',
        description: 'Alle Ausgaben',
        depth: 0,
        childrenCount: 0,
        isArchived: false,
        parentAccountId: null,
        createdAt: new Date(now.getFullYear() - 1, 0, 1),
        updatedAt: now,
      },
    ];
  }
}
