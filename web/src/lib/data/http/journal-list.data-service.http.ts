import { Injectable, inject } from '@angular/core';
import { Observable, EMPTY, combineLatest, map, of, switchMap, expand, reduce, catchError, from, concatMap } from 'rxjs';
import { TransactionServiceService } from '../../api/services/transaction-service.service';
import { TransactionAssignmentServiceService } from '../../api/services/transaction-assignment-service.service';
import { LedgerAccountServiceService } from '../../api/services/ledger-account-service.service';
import { AccountServiceService } from '../../api/services/account-service.service';
import { V1Transaction } from '../../api/models/v1transaction';
import { V1TransactionAssignment } from '../../api/models/v1transaction-assignment';
import { V1LedgerAccount } from '../../api/models/v1ledger-account';
import { V1Account } from '../../api/models/v1account';
import {
  JournalListDataService,
  JournalEntry,
  JournalEntryFilters,
  JournalAssignmentStatus,
  JournalAccountAssignment,
} from '../../../app/routes/journal/journal-list/journal-list.data-service';
import { extractUidFromResourceName } from './_mappers';

/**
 * Number of assignment-list requests issued in parallel. Each request is for a
 * single transaction, so this controls the maximum concurrent HTTP connections
 * open while loading assignments for a journal page.
 */
const ASSIGNMENT_BATCH_SIZE = 20;

/**
 * Maximum number of ledger-account resource names sent in a single batchGet
 * request. The server enforces a limit on the number of names per request;
 * chunking keeps the client within that bound.
 */
const LEDGER_ACCOUNT_BATCH_SIZE = 20;

@Injectable()
export class HttpJournalListDataService extends JournalListDataService {
  private readonly txnSvc = inject(TransactionServiceService);
  private readonly assignmentSvc = inject(TransactionAssignmentServiceService);
  private readonly ledgerAccountSvc = inject(LedgerAccountServiceService);
  private readonly accountSvc = inject(AccountServiceService);

  listTransactions(
    organizationId: string,
    pageSize: number,
    pageToken: string | undefined,
    filters?: JournalEntryFilters,
  ): Observable<{ entries: JournalEntry[]; total: number; nextPageToken?: string }> {
    const parent = `organizations/${organizationId}`;

    // Step 1: fetch one page of transactions, ordered by document date so the
    // cursor pagination is stable.
    return this.txnSvc
      .TransactionServiceListTransactions({
        parent,
        pageSize,
        pageToken,
        orderBy: 'document_date desc',
        filter: this.buildApiFilter(filters),
      })
      .pipe(
        switchMap((txnResp) => {
          const transactions = txnResp.transactions ?? [];
          const total = Number(txnResp.total_size ?? 0);
          const nextPageToken = txnResp.next_page_token;

          if (transactions.length === 0) {
            return of({
              transactions,
              ledgerAccountsMap: new Map<string, V1LedgerAccount>(),
              accountsMap: new Map<string, V1Account>(),
              assignmentsByTxn: new Map<string, V1TransactionAssignment[]>(),
              total,
              nextPageToken,
            });
          }

          const ledgerAccountNames = this.collectLedgerAccountNames(transactions);

          // Chunk the ledger-account names into groups of at most
          // LEDGER_ACCOUNT_BATCH_SIZE to stay within the server's per-request
          // name limit.
          const ledgerAccountChunks: string[][] = [];
          for (let i = 0; i < ledgerAccountNames.length; i += LEDGER_ACCOUNT_BATCH_SIZE) {
            ledgerAccountChunks.push(ledgerAccountNames.slice(i, i + LEDGER_ACCOUNT_BATCH_SIZE));
          }

          return combineLatest([
            of(transactions),
            ledgerAccountChunks.length > 0
              ? combineLatest(
                  ledgerAccountChunks.map((chunk) =>
                    this.ledgerAccountSvc.LedgerAccountServiceBatchGetLedgerAccounts({
                      parent,
                      names: chunk,
                    }).pipe(
                      map((resp) => resp.ledger_accounts ?? []),
                      catchError(() => of<V1LedgerAccount[]>([])),
                    ),
                  ),
                ).pipe(
                  map((chunks) => {
                    const map = new Map<string, V1LedgerAccount>();
                    for (const accounts of chunks) {
                      for (const a of accounts) {
                        const uid = a.uid ?? '';
                        if (uid) {
                          map.set(uid, a);
                        }
                      }
                    }
                    return map;
                  }),
                )
              : of(new Map<string, V1LedgerAccount>()),
            this.loadAllAccounts(parent),
            this.loadAssignmentsForTransactions(transactions),
          ]).pipe(
            map(([transactions, ledgerAccountsMap, accountsMap, assignmentsByTxn]) => ({
              transactions,
              ledgerAccountsMap,
              accountsMap,
              assignmentsByTxn,
              total,
              nextPageToken,
            })),
          );
        }),
        map(({ transactions, ledgerAccountsMap, accountsMap, assignmentsByTxn, total, nextPageToken }) => {
          const entries: JournalEntry[] = transactions.map((t) => {
            const debitUid = t.debit_ledger_account?.split('/').pop() ?? '';
            const creditUid = t.credit_ledger_account?.split('/').pop() ?? '';
            const debitAcct = ledgerAccountsMap.get(debitUid);
            const creditAcct = ledgerAccountsMap.get(creditUid);

            const rawAssignments = assignmentsByTxn.get(t.name ?? '') ?? [];
            const amount = t.amount?.value ?? '';

            const assignments: JournalAccountAssignment[] = rawAssignments.map((a) => {
              const accountUid = extractUidFromResourceName(a.account ?? '');
              const acct = accountsMap.get(accountUid);
              return {
                id: a.uid ?? '',
                accountId: accountUid,
                accountCode: acct?.display_code ?? '',
                accountName: acct?.display_name ?? '',
                value: a.value?.value ?? '',
              };
            });

            return {
              id: t.uid ?? '',
              documentDate: new Date(t.document_date),
              bookedAt: new Date(t.booked_at),
              amount,
              reference: t.reference ?? '',
              debitAccountCode: debitAcct?.code ?? '',
              debitAccountName: debitAcct?.display_name ?? '',
              creditAccountCode: creditAcct?.code ?? '',
              creditAccountName: creditAcct?.display_name ?? '',
              description: t.description ?? '',
              assignmentStatus: this.deriveAssignmentStatus(amount, assignments),
              accountAssignments: assignments,
            };
          });

          // Apply filters that the API does not support (text query and
          // assignment status). Date filtering is already done server-side.
          let filtered = entries;
          if (filters?.query) {
            const q = filters.query.toLowerCase();
            filtered = filtered.filter(
              (e) =>
                e.description.toLowerCase().includes(q) ||
                e.reference.toLowerCase().includes(q) ||
                e.debitAccountName.toLowerCase().includes(q) ||
                e.creditAccountName.toLowerCase().includes(q),
            );
          }
          if (filters?.assignmentStatus && filters.assignmentStatus !== 'all') {
            filtered = filtered.filter(
              (e) => e.assignmentStatus === filters.assignmentStatus,
            );
          }

          return {
            entries: filtered,
            total,
            nextPageToken,
          };
        }),
      );
  }

  private collectLedgerAccountNames(transactions: V1Transaction[]): string[] {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const t of transactions) {
      for (const name of [t.debit_ledger_account, t.credit_ledger_account]) {
        if (name && !seen.has(name)) {
          seen.add(name);
          names.push(name);
        }
      }
    }
    return names;
  }

  private loadAllAccounts(parent: string): Observable<Map<string, V1Account>> {
    return this.accountSvc.AccountServiceListAccounts({ parent, pageSize: 100, showDeleted: false }).pipe(
      expand((resp) =>
        resp.next_page_token
          ? this.accountSvc.AccountServiceListAccounts({
              parent,
              pageSize: 100,
              pageToken: resp.next_page_token,
              showDeleted: false,
            })
          : EMPTY,
      ),
      reduce((all: V1Account[], resp) => all.concat(resp.accounts ?? []), []),
      map((accounts) => {
        const map = new Map<string, V1Account>();
        for (const a of accounts) {
          const uid = a.uid ?? '';
          if (uid) {
            map.set(uid, a);
          }
        }
        return map;
      }),
      catchError(() => of(new Map<string, V1Account>())),
    );
  }

  private loadAssignmentsForTransactions(
    transactions: V1Transaction[],
  ): Observable<Map<string, V1TransactionAssignment[]>> {
    if (transactions.length === 0) {
      return of(new Map<string, V1TransactionAssignment[]>());
    }

    const txnNames = transactions.map((t) => t.name ?? '').filter((n) => n.length > 0);

    // One request per transaction. They are chunked and processed sequentially
    // so the browser does not open too many parallel HTTP connections.
    const chunks: string[][] = [];
    for (let i = 0; i < txnNames.length; i += ASSIGNMENT_BATCH_SIZE) {
      chunks.push(txnNames.slice(i, i + ASSIGNMENT_BATCH_SIZE));
    }

    if (chunks.length === 0) {
      return of(new Map<string, V1TransactionAssignment[]>());
    }

    const loadAssignmentsForTxn = (txnName: string) =>
      this.assignmentSvc
        .TransactionAssignmentServiceListTransactionAssignments({
          parent1: txnName,
          pageSize: 100,
        })
        .pipe(
          expand((resp) =>
            resp.next_page_token
              ? this.assignmentSvc.TransactionAssignmentServiceListTransactionAssignments({
                  parent1: txnName,
                  pageSize: 100,
                  pageToken: resp.next_page_token,
                })
              : EMPTY,
          ),
          reduce((all: V1TransactionAssignment[], resp) => all.concat(resp.assignments ?? []), []),
          catchError(() => of<V1TransactionAssignment[]>([])),
        );

    return from(chunks).pipe(
      concatMap((chunk) =>
        combineLatest(chunk.map((txnName) => loadAssignmentsForTxn(txnName))).pipe(
          map((chunkResults) => chunkResults.flat()),
        ),
      ),
      reduce((all: V1TransactionAssignment[], chunkAssignments) => all.concat(chunkAssignments), []),
      map((assignments) => {
        const result = new Map<string, V1TransactionAssignment[]>();
        for (const a of assignments) {
          const txnName = a.transaction ?? '';
          const list = result.get(txnName) ?? [];
          list.push(a);
          result.set(txnName, list);
        }
        return result;
      }),
    );
  }

  private buildApiFilter(filters?: JournalEntryFilters): string | undefined {
    // The backend only supports booked_at in transaction filters, so use that
    // as a server-side pre-filter for the date range.
    const parts: string[] = [];
    if (filters?.afterDate) {
      parts.push(`booked_at>="${filters.afterDate}T00:00:00Z"`);
    }
    if (filters?.beforeDate) {
      parts.push(`booked_at<="${filters.beforeDate}T23:59:59Z"`);
    }
    return parts.length > 0 ? parts.join(' AND ') : undefined;
  }

  private deriveAssignmentStatus(
    amount: string,
    assignments: JournalAccountAssignment[],
  ): JournalAssignmentStatus {
    if (assignments.length === 0) {
      return 'open';
    }
    const total = parseFloat(amount);
    const assigned = assignments.reduce(
      (sum, a) => sum + parseFloat(a.value || '0'),
      0,
    );
    if (total > 0 && Math.abs(assigned - total) < 0.01) {
      return 'assigned';
    }
    return 'partial';
  }
}
