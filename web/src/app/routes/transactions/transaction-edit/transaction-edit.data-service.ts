import { Observable } from 'rxjs';
import { Transaction, Account, TransactionAssignment } from '../../../shared/models';

export interface CreateAssignmentParams {
  accountId: string;
  value: string;
}

export interface UpdateAssignmentParams {
  accountId: string;
  value: string;
}

export abstract class TransactionEditDataService {
  abstract getTransaction(organizationId: string, id: string): Observable<Transaction>;
  abstract listAvailableAccounts(organizationId: string): Observable<Account[]>;
  abstract createAssignment(organizationId: string, transactionId: string, params: CreateAssignmentParams): Observable<TransactionAssignment>;
  abstract updateAssignment(organizationId: string, transactionId: string, assignmentId: string, params: UpdateAssignmentParams): Observable<TransactionAssignment>;
  abstract deleteAssignment(organizationId: string, transactionId: string, assignmentId: string): Observable<void>;
}
