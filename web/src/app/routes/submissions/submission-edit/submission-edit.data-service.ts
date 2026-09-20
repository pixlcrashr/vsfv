import { Observable } from 'rxjs';
import {
  Submission,
  SubmissionComment,
  SubmissionAuditEntry,
  SubmissionStatus,
  SubmissionScope,
  SubmissionItem,
  DocumentForm,
  Attachment,
} from '../../../shared/models';
import { Committee } from '../../../shared/models';

export interface UpdateSubmissionParams {
  notice?: string | null;
  // Scope changes require the treasury update permission (server-enforced).
  scope?: SubmissionScope;
}

export interface AddItemParams {
  category: string;
  documentForm: DocumentForm;
  source: string | null;
  description: string | null;
  amount: number; // in cents
}

export interface UpdateItemParams {
  category?: string;
  documentForm?: DocumentForm;
  source?: string | null;
  description?: string | null;
  amount?: number;
}

export interface AddCommentParams {
  content: string;
  isAdminOnly: boolean;
  newStatus?: SubmissionStatus;
}

export abstract class SubmissionEditDataService {
  abstract getSubmission(id: string): Observable<Submission>;

  abstract updateSubmission(id: string, params: UpdateSubmissionParams): Observable<Submission>;

  // Lifecycle transitions; the target status maps to the matching verb
  // (approve / reject / requestFurtherInfo / complete).
  abstract changeStatus(id: string, newStatus: SubmissionStatus, comment?: string): Observable<Submission>;

  // Items (single resources; add/remove bills after creation)
  abstract addItem(submissionId: string, params: AddItemParams): Observable<SubmissionItem>;

  abstract updateItem(submissionId: string, itemId: string, params: UpdateItemParams): Observable<SubmissionItem>;

  abstract deleteItem(submissionId: string, itemId: string): Observable<void>;

  // Attachments (binary transfer via the Huma exception API)
  abstract uploadAttachment(submissionId: string, itemId: string, file: File): Observable<Attachment>;

  abstract deleteAttachment(submissionId: string, itemId: string, attachmentId: string): Observable<void>;

  // Confirm original document received (treasury)
  abstract confirmOriginalReceived(submissionId: string, itemId: string): Observable<SubmissionItem>;

  // Comments (admin-only visibility handled server-side)
  abstract getComments(submissionId: string): Observable<SubmissionComment[]>;

  abstract addComment(submissionId: string, params: AddCommentParams): Observable<SubmissionComment>;

  // Audit log
  abstract getAuditLog(submissionId: string): Observable<SubmissionAuditEntry[]>;

  // Reference data
  abstract getCommittees(): Observable<Committee[]>;
}
