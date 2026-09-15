import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, map, throwError } from 'rxjs';
import { AccountGroupServiceService } from '../../api/services/account-group-service.service';
import { AccountGroupAssignmentServiceService } from '../../api/services/account-group-assignment-service.service';
import { AccountServiceService } from '../../api/services/account-service.service';
import { BudgetServiceService } from '../../api/services/budget-service.service';
import { AccountGroupStats, Budget, BudgetTag } from '../../../app/shared/models';
import { AccountGroupStatsDataService } from '../../../app/routes/account-groups/account-group-stats/account-group-stats.data-service';
import { mapApiAccountGroupAssignment, mapApiBudget } from './_mappers';
import { naturalCompare } from '../../../app/shared/utils/account-sort.utils';

@Injectable()
export class HttpAccountGroupStatsDataService extends AccountGroupStatsDataService {
  private readonly groupSvc = inject(AccountGroupServiceService);
  private readonly assignmentSvc = inject(AccountGroupAssignmentServiceService);
  private readonly accountSvc = inject(AccountServiceService);
  private readonly budgetSvc = inject(BudgetServiceService);

  private groupName(organizationId: string, uid: string): string {
    return `organizations/${organizationId}/accountGroups/${uid}`;
  }

  listBudgets(organizationId: string): Observable<Budget[]> {
    return this.budgetSvc.BudgetServiceListBudgets({ parent: `organizations/${organizationId}`, pageSize: 100 }).pipe(
      map((resp) => (resp.budgets ?? []).map(mapApiBudget)),
    );
  }

  listBudgetRevisions(_organizationId: string, _budgetId: string): Observable<BudgetTag[]> {
    // TODO: No generated API endpoint for budget revision listing.
    return throwError(() => new Error('Budget revision API is not yet implemented.'));
  }

  getGroupStats(organizationId: string, groupId: string, _budgetId: string): Observable<AccountGroupStats> {
    const groupName = this.groupName(organizationId, groupId);
    return combineLatest([
      this.groupSvc.AccountGroupServiceGetAccountGroup(groupName),
      this.assignmentSvc.AccountGroupAssignmentServiceListAccountGroupAssignments({ parent: groupName, pageSize: 100 }),
      this.accountSvc.AccountServiceListAccounts({ parent: `organizations/${organizationId}`, pageSize: 100, showDeleted: false }),
    ]).pipe(
      map(([group, assignmentsResp, accountsResp]) => {
        const accountsMap = new Map(
          (accountsResp.accounts ?? []).map((a) => [a.uid ?? '', a]),
        );
        const accounts = (assignmentsResp.assignments ?? []).map((a) => {
          const acct = accountsMap.get(a.account_id);
          return mapApiAccountGroupAssignment(
            a,
            acct?.display_name ?? '',
            acct?.display_code ?? '',
          );
        });
        accounts.sort((a, b) => naturalCompare(a.accountCode, b.accountCode));
        return {
          id: group.uid ?? '',
          name: group.display_name,
          targetValue: '0',
          actualValue: '0',
          transactionCount: 0,
          accounts,
        };
      }),
    );
  }

  getGroupStatsByRevision(_organizationId: string, _groupId: string, _budgetId: string, _budgetRevisionId: string): Observable<AccountGroupStats> {
    // TODO: No generated API endpoint for revision-specific stats.
    return throwError(() => new Error('Revision-specific stats API is not yet implemented.'));
  }
}
