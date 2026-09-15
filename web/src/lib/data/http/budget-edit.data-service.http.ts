import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { Decimal } from 'decimal.js';
import { BudgetServiceService } from '../../api/services/budget-service.service';
import { BudgetRevisionServiceService } from '../../api/services/budget-revision-service.service';
import { BudgetAccountValueServiceService } from '../../api/services/budget-account-value-service.service';
import { BudgetRevisionAccountValueServiceService } from '../../api/services/budget-revision-account-value-service.service';
import { AccountServiceService } from '../../api/services/account-service.service';
import { AuditLogServiceService } from '../../api/services/audit-log-service.service';
import { AuditLogHistoryEntry, BudgetTag } from '../../../app/shared/models';
import {
  BudgetEditDataService,
  BudgetDetails,
  BudgetChange,
  UpdateBudgetParams,
} from '../../../app/routes/budgets/budget-edit/budget-edit.data-service';
import {
  mapApiBudget,
  mapApiBudgetTag,
  dateToTypeDate,
  extractUidFromResourceName,
  auditLogHistoryEntryFromApi,
} from './_mappers';
import { naturalCompare } from '../../../app/shared/utils/account-sort.utils';

@Injectable()
export class HttpBudgetEditDataService extends BudgetEditDataService {
  private readonly svc = inject(BudgetServiceService);
  private readonly revisionSvc = inject(BudgetRevisionServiceService);
  private readonly accountValueSvc = inject(BudgetAccountValueServiceService);
  private readonly revisionAccountValueSvc = inject(BudgetRevisionAccountValueServiceService);
  private readonly accountSvc = inject(AccountServiceService);
  private readonly auditLogSvc = inject(AuditLogServiceService);

  private budgetName(organizationId: string, uid: string): string {
    return `organizations/${organizationId}/budgets/${uid}`;
  }

  override getBudget(organizationId: string, budgetId: string): Observable<BudgetDetails> {
    const name = this.budgetName(organizationId, budgetId);

    const budget$ = this.svc.BudgetServiceGetBudget(name);
    const revisions$ = this.revisionSvc.BudgetRevisionServiceListBudgetRevisions({
      parent: name,
      pageSize: 100,
      orderBy: 'create_time desc',
    });
    const currentValues$ = this.accountValueSvc.BudgetAccountValueServiceListBudgetAccountValues({
      parent: name,
      pageSize: 100,
    });

    return forkJoin({
      budget: budget$,
      revisions: revisions$,
      currentValues: currentValues$,
    }).pipe(
      switchMap(({ budget, revisions, currentValues }) => {
        const tags: BudgetTag[] = (revisions.revisions ?? []).map(mapApiBudgetTag);

        const currentMap = new Map<string, Decimal>();
        for (const av of currentValues.account_values ?? []) {
          const accountId = extractUidFromResourceName(av.account);
          currentMap.set(accountId, new Decimal(av.value?.value ?? '0'));
        }

        const latestRevision = revisions.revisions?.[0];

        if (!latestRevision?.name) {
          return of({
            ...mapApiBudget(budget),
            tags,
            hasUntaggedChanges: false,
            changes: [],
          });
        }

        return this.revisionAccountValueSvc
          .BudgetRevisionAccountValueServiceListBudgetRevisionAccountValues({
            parent1: latestRevision.name,
            pageSize: 200,
          })
          .pipe(
            switchMap((revisionValues) => {
              const revisionMap = new Map<string, Decimal>();
              for (const rav of revisionValues.account_values ?? []) {
                const accountId = extractUidFromResourceName(rav.account ?? '');
                revisionMap.set(accountId, new Decimal(rav.value?.value ?? '0'));
              }

              const changes: BudgetChange[] = [];
              const allAccountIds = new Set<string>([
                ...currentMap.keys(),
                ...revisionMap.keys(),
              ]);

              for (const accountId of allAccountIds) {
                const current = currentMap.get(accountId) ?? new Decimal(0);
                const revision = revisionMap.get(accountId) ?? new Decimal(0);
                const diff = current.minus(revision);
                if (!diff.equals(0)) {
                  changes.push({
                    accountId,
                    accountFullCode: '',
                    accountName: '',
                    previousValue: revision,
                    newValue: current,
                    diff,
                  });
                }
              }

              if (changes.length === 0) {
                return of({
                  ...mapApiBudget(budget),
                  tags,
                  hasUntaggedChanges: false,
                  changes,
                });
              }

              const orgParent = `organizations/${organizationId}`;
              return this.accountSvc.AccountServiceListAccounts({
                parent: orgParent,
                pageSize: 100,
              }).pipe(
                map((accountsResp) => {
                  const accountMap = new Map<string, { code: string; name: string }>();
                  for (const a of accountsResp.accounts ?? []) {
                    accountMap.set(a.uid ?? '', {
                      code: a.display_code ?? '',
                      name: a.display_name ?? '',
                    });
                  }
                  for (const c of changes) {
                    const info = accountMap.get(c.accountId);
                    if (info) {
                      c.accountFullCode = info.code;
                      c.accountName = info.name;
                    }
                  }
                  changes.sort((a, b) => naturalCompare(a.accountFullCode, b.accountFullCode));
                  return {
                    ...mapApiBudget(budget),
                    tags,
                    hasUntaggedChanges: true,
                    changes,
                  };
                }),
              );
            }),
          );
      }),
    );
  }

  override createBudgetRevision(
    organizationId: string,
    budgetId: string,
    date: Date,
    name: string,
    description: string,
    _force: boolean,
  ): Observable<BudgetTag> {
    const parent = this.budgetName(organizationId, budgetId);
    return this.revisionSvc
      .BudgetRevisionServiceCreateBudgetRevision({
        parent,
        revision: {
          display_name: name,
          display_description: description,
          date: dateToTypeDate(date),
        },
      })
      .pipe(map(mapApiBudgetTag));
  }

  override deleteBudgetRevision(_organizationId: string, budgetRevisionId: string): Observable<void> {
    return of(void 0);
  }

  override updateBudgetRevision(organizationId: string, budgetId: string, budgetRevisionId: string, isPublished: boolean): Observable<void> {
    const revisionName = `organizations/${organizationId}/budgets/${budgetId}/revisions/${budgetRevisionId}`;
    return this.revisionSvc
      .BudgetRevisionServiceUpdateBudgetRevision({
        revisionName,
        revision: {
          display_name: '',
          is_published: isPublished,
        },
      })
      .pipe(map(() => undefined));
  }

  updateBudget(
    organizationId: string,
    budgetId: string,
    params: UpdateBudgetParams,
  ): Observable<void> {
    return this.svc
      .BudgetServiceUpdateBudget({
        budgetName: this.budgetName(organizationId, budgetId),
        budget: {
          display_name: params.name,
          display_description: params.description,
          is_published: params.isPublished,
          publish_actual_values: params.publishActualValues,
          publish_actual_values_until: params.publishActualValuesUntil
            ? dateToTypeDate(params.publishActualValuesUntil)
            : undefined,
          period_start: { year: 0, month: 0, day: 0 },
          period_end: { year: 0, month: 0, day: 0 },
        } as any,
      })
      .pipe(map(() => undefined));
  }

  closeBudget(organizationId: string, budgetId: string): Observable<void> {
    return this.svc
      .BudgetServiceCloseBudget({ name: this.budgetName(organizationId, budgetId), body: {} })
      .pipe(map(() => undefined));
  }

  override getAuditLog(organizationId: string, budgetId: string): Observable<AuditLogHistoryEntry[]> {
    // Substring match so entries for the budget's revisions and account
    // values are included as well.
    return this.auditLogSvc
      .AuditLogServiceListAuditLogEntries({
        pageSize: 200,
        filter: `resource:"${this.budgetName(organizationId, budgetId)}"`,
      })
      .pipe(map((resp) => (resp.audit_log_entries ?? []).map(auditLogHistoryEntryFromApi)));
  }

  override listAccountLabels(organizationId: string): Observable<ReadonlyMap<string, string>> {
    return this.accountSvc
      .AccountServiceListAccounts({
        parent: `organizations/${organizationId}`,
        pageSize: 100,
      })
      .pipe(
        map((resp) => {
          const map = new Map<string, string>();
          for (const a of resp.accounts ?? []) {
            const label = `${a.display_code ?? ''} ${a.display_name ?? ''}`.trim();
            map.set(a.uid ?? '', label);
          }
          return map;
        }),
      );
  }
}
