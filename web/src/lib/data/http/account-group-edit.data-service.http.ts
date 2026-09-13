import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, map, of, switchMap } from 'rxjs';
import { AccountGroupServiceService } from '../../api/services/account-group-service.service';
import { AccountGroupAssignmentServiceService } from '../../api/services/account-group-assignment-service.service';
import { AccountServiceService } from '../../api/services/account-service.service';
import { AuditLogServiceService } from '../../api/services/audit-log-service.service';
import { Account, AccountGroupOperation, AuditLogHistoryEntry } from '../../../app/shared/models';
import {
  AccountGroupEditDataService,
  AccountGroupDetails,
  AccountWithOperation,
} from '../../../app/routes/account-groups/account-group-edit/account-group-edit.data-service';
import { mapApiAccount, mapApiAccountGroupAssignment, auditLogHistoryEntryFromApi } from './_mappers';

@Injectable()
export class HttpAccountGroupEditDataService extends AccountGroupEditDataService {
  private readonly groupSvc = inject(AccountGroupServiceService);
  private readonly assignmentSvc = inject(AccountGroupAssignmentServiceService);
  private readonly accountSvc = inject(AccountServiceService);
  private readonly auditLogSvc = inject(AuditLogServiceService);

  private groupName(organizationId: string, uid: string): string {
    return `organizations/${organizationId}/accountGroups/${uid}`;
  }

  private assignmentName(organizationId: string, groupId: string, assignmentId: string): string {
    return `${this.groupName(organizationId, groupId)}/assignments/${assignmentId}`;
  }

  getGroup(organizationId: string, id: string): Observable<AccountGroupDetails> {
    const groupName = this.groupName(organizationId, id);
    return combineLatest([
      this.groupSvc.AccountGroupServiceGetAccountGroup(groupName),
      this.assignmentSvc.AccountGroupAssignmentServiceListAccountGroupAssignments({ parent: groupName, pageSize: 100 }),
      this.accountSvc.AccountServiceListAccounts({ parent: `organizations/${organizationId}`, pageSize: 100, showDeleted: false }),
    ]).pipe(
      map(([group, assignmentsResp, accountsResp]) => {
        const accountsMap = new Map(
          (accountsResp.accounts ?? []).map((a) => [a.uid ?? '', a]),
        );
        const assignments = (assignmentsResp.assignments ?? []).map((a) => {
          const acct = accountsMap.get(a.account_id);
          return mapApiAccountGroupAssignment(
            a,
            acct?.display_name ?? '',
            acct?.display_code ?? '',
          );
        });
        return {
          id: group.uid ?? '',
          name: group.display_name,
          description: group.display_description ?? '',
          assignmentCount: assignments.length,
          assignments,
        };
      }),
    );
  }

  updateGroup(organizationId: string, id: string, name: string, description: string): Observable<AccountGroupDetails> {
    return this.groupSvc.AccountGroupServiceUpdateAccountGroup({
      accountGroupName: this.groupName(organizationId, id),
      accountGroup: { display_name: name, display_description: description },
    }).pipe(switchMap(() => this.getGroup(organizationId, id)));
  }

  getAllAccountsWithOperations(organizationId: string, groupId: string): Observable<AccountWithOperation[]> {
    const groupName = this.groupName(organizationId, groupId);
    return combineLatest([
      this.accountSvc.AccountServiceListAccounts({ parent: `organizations/${organizationId}`, pageSize: 1000, showDeleted: true }),
      this.assignmentSvc.AccountGroupAssignmentServiceListAccountGroupAssignments({ parent: groupName, pageSize: 1000 }),
    ]).pipe(
      map(([accountsResp, assignmentsResp]) => {
        const accounts = (accountsResp.accounts ?? []).map(mapApiAccount);
        const assignmentsMap = new Map(
          (assignmentsResp.assignments ?? []).map((a) => [a.account_id, a]),
        );

        return accounts.map((account) => {
          const apiAssignment = assignmentsMap.get(account.id);
          const assignment = apiAssignment
            ? {
                id: apiAssignment.uid ?? '',
                accountId: apiAssignment.account_id,
                accountCode: account.code,
                accountName: account.name,
                operation: (apiAssignment.negate ? 'S' : 'A') as AccountGroupOperation,
                targetValue: '0',
                actualValue: '0',
              }
            : null;

          return { account, assignment };
        });
      }),
    );
  }

  private getAvailableAccounts(organizationId: string): Observable<Account[]> {
    return this.accountSvc.AccountServiceListAccounts({ parent: `organizations/${organizationId}`, pageSize: 100, showDeleted: false }).pipe(
      map((resp) => (resp.accounts ?? []).map(mapApiAccount)),
    );
  }

  override updateAccountOperation(
    organizationId: string,
    accountGroupId: string,
    accountId: string,
    operation: AccountGroupOperation,
    assignmentId?: string | null,
  ): Observable<string | null> {
    // 'I' (ignore) is represented by the absence of an assignment.
    if (operation === 'I') {
      if (!assignmentId) {
        return of(null);
      }
      return this.assignmentSvc
        .AccountGroupAssignmentServiceDeleteAccountGroupAssignment(
          this.assignmentName(organizationId, accountGroupId, assignmentId),
        )
        .pipe(map(() => null));
    }

    const negate = operation === 'S';
    if (assignmentId) {
      return this.assignmentSvc
        .AccountGroupAssignmentServiceUpdateAccountGroupAssignment({
          assignmentName: this.assignmentName(organizationId, accountGroupId, assignmentId),
          assignment: { account_id: accountId, negate },
        })
        .pipe(map((a) => a.uid ?? assignmentId));
    }

    return this.assignmentSvc
      .AccountGroupAssignmentServiceCreateAccountGroupAssignment({
        parent: this.groupName(organizationId, accountGroupId),
        assignment: { account_id: accountId, negate },
      })
      .pipe(map((a) => a.uid ?? ''));
  }

  deleteGroup(organizationId: string, id: string): Observable<void> {
    return this.groupSvc.AccountGroupServiceDeleteAccountGroup(this.groupName(organizationId, id)).pipe(map(() => undefined));
  }

  getAuditLog(organizationId: string, accountGroupId: string): Observable<AuditLogHistoryEntry[]> {
    // Substring match so entries for the group's assignments are included as well.
    return this.auditLogSvc
      .AuditLogServiceListAuditLogEntries({
        pageSize: 200,
        filter: `resource:"${this.groupName(organizationId, accountGroupId)}"`,
      })
      .pipe(map((resp) => (resp.audit_log_entries ?? []).map(auditLogHistoryEntryFromApi)));
  }
}
