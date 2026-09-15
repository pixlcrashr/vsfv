import { Observable } from 'rxjs';

export type JournalAssignmentStatus = 'ignored' | 'assigned' | 'partial' | 'open';

export interface JournalAccountAssignment {
  id: string;
  accountId: string;
  accountCode: string;
  /**
   * Dash-joined ancestor code chain from the root account down to the account
   * itself (e.g. "A-1-2-3-4"), provided by the API's full_code field.
   */
  accountFullCode: string;
  accountName: string;
  value: string;
}

export interface JournalEntry {
  id: string;
  documentDate: Date;
  bookedAt: Date;
  amount: string;
  reference: string;
  debitAccountCode: string;
  debitAccountName: string;
  creditAccountCode: string;
  creditAccountName: string;
  description: string;
  assignmentStatus: JournalAssignmentStatus;
  accountAssignments: JournalAccountAssignment[];
}

export interface JournalEntryFilters {
  afterDate?: string;
  beforeDate?: string;
  query?: string;
  assignmentStatus?: 'all' | JournalAssignmentStatus;
}

export abstract class JournalListDataService {
  /**
   * Lists transactions for an organization, each fully populated with its
   * account assignments (see {@link JournalEntry.accountAssignments}) and
   * derived {@link JournalEntry.assignmentStatus}.
   *
   * Implementations are responsible for bulk-loading the assignments for all
   * returned transactions so that callers do not need to issue per-row
   * requests.
   */
  abstract listTransactions(
    organizationId: string,
    pageSize: number,
    pageToken: string | undefined,
    filters?: JournalEntryFilters,
  ): Observable<{ entries: JournalEntry[]; total: number; nextPageToken?: string }>;
}
