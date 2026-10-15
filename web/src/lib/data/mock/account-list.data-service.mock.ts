import { Injectable, inject } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { faker } from '@faker-js/faker';
import { Account, HierarchicalAccount } from '../../../app/shared/models';
import { AccountListDataService } from '../../../app/routes/accounts/account-list/account-list.data-service';
import { AccountHierarchyService } from '../../../app/shared/services/account-hierarchy.service';

@Injectable()
export class MockAccountListDataService extends AccountListDataService {
  private readonly hierarchy = inject(AccountHierarchyService);
  private accountsByOrg = new Map<string, Account[]>();

  private getAccounts(organizationId: string): Account[] {
    if (!this.accountsByOrg.has(organizationId)) {
      this.accountsByOrg.set(organizationId, this.generateAccounts());
    }
    return this.accountsByOrg.get(organizationId)!;
  }

  listAccounts(organizationId: string): Observable<HierarchicalAccount[]> {
    const flat = [...this.getAccounts(organizationId)];
    return of(this.hierarchy.tree(flat)).pipe(delay(300));
  }

  createAccount(
    organizationId: string,
    name: string,
    code: string,
    description: string,
    parentAccountId: string | null,
    isContainer: boolean,
    invertSign: boolean,
  ): Observable<Account> {
    const accounts = this.getAccounts(organizationId);
    const newAccount: Account = {
      id: faker.string.uuid(),
      name,
      code,
      fullCode: code,
      description,
      isArchived: false,
      isContainer,
      invertSign,
      parentAccountId,
    };

    accounts.push(newAccount);

    return of(newAccount).pipe(delay(300));
  }

  archiveAccount(organizationId: string, id: string): Observable<void> {
    const account = this.getAccounts(organizationId).find((a) => a.id === id);
    if (account) {
      account.isArchived = true;
    }
    return of(undefined).pipe(delay(300));
  }

  restoreAccount(organizationId: string, id: string): Observable<void> {
    const account = this.getAccounts(organizationId).find((a) => a.id === id);
    if (account) {
      account.isArchived = false;
    }
    return of(undefined).pipe(delay(300));
  }

  private generateAccounts(): Account[] {
    const einnahmenId = faker.string.uuid();
    const ausgabenId = faker.string.uuid();
    const ruecklagenId = faker.string.uuid();
    const personalId = faker.string.uuid();
    const sachmittelId = faker.string.uuid();
    const verwaltungId = faker.string.uuid();

    const accounts: Account[] = [
      this.createAccountNode(einnahmenId, null, '1', 'Einnahmen', 'Alle Einnahmen', false, true),
      this.createAccountNode(ausgabenId, null, '2', 'Ausgaben', 'Alle Ausgaben', false, true),
      this.createAccountNode(ruecklagenId, null, '3', 'Rücklagen', 'Rücklagen und Reserven', false, true),

      // Einnahmen children
      this.createAccountNode(faker.string.uuid(), einnahmenId, '1.1', 'Mitgliedsbeiträge', 'Einnahmen aus Mitgliedsbeiträgen'),
      this.createAccountNode(faker.string.uuid(), einnahmenId, '1.2', 'Zuschüsse', 'Öffentliche Zuschüsse'),
      this.createAccountNode(faker.string.uuid(), einnahmenId, '1.3', 'Spenden', 'Spendeneinnahmen'),

      // Ausgaben children
      this.createAccountNode(personalId, ausgabenId, '2.1', 'Personal', 'Personalkosten', false, true),
      this.createAccountNode(sachmittelId, ausgabenId, '2.2', 'Sachmittel', 'Sachmittel und Material', false, true),
      this.createAccountNode(faker.string.uuid(), ausgabenId, '2.3', 'Veranstaltungen', 'Veranstaltungskosten'),
      this.createAccountNode(verwaltungId, ausgabenId, '2.4', 'Verwaltung', 'Verwaltungskosten', true),

      // Personal sub-children
      this.createAccountNode(faker.string.uuid(), personalId, '2.1.1', 'Gehälter', 'Gehaltszahlungen'),
      this.createAccountNode(faker.string.uuid(), personalId, '2.1.2', 'Sozialabgaben', 'Arbeitgeberanteile Sozialversicherung'),
    ];

    return accounts;
  }

  private createAccountNode(
    id: string,
    parentAccountId: string | null,
    code: string,
    name: string,
    description: string,
    isArchived = false,
    isContainer = false,
  ): Account {
    return {
      id,
      code,
      fullCode: code,
      name,
      description,
      isArchived,
      isContainer,
      parentAccountId,
    };
  }
}
