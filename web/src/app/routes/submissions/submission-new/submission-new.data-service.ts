import { Observable } from 'rxjs';
import {
  Attachment,
  Committee,
  SettlementPayload,
  Submission,
  SubmissionDirection,
  SubmissionItem,
  SubmissionScope,
  SubmissionType,
  DocumentForm,
} from '../../../shared/models';

export interface CreateItemParams {
  category: string;
  documentForm: DocumentForm;
  source: string | null; // income origin only
  description: string | null;
  amount: number; // in cents
}

export type { SettlementPayload } from '../../../shared/models';

export interface CreateSubmissionParams {
  committeeId: string;
  // misc submissions are documentation-only; direction/settlement/scope only
  // apply to income_expense submissions.
  type: SubmissionType;
  direction: SubmissionDirection | null;
  // Null for income and misc submissions (no settlement takes place).
  settlement: SettlementPayload | null;
  scope: SubmissionScope | null;
  notice: string | null;
  items: CreateItemParams[];
}

export abstract class SubmissionNewDataService {
  abstract getCommitteeOptions(): Observable<Committee[]>;

  // Creates the server-side draft (SUBMISSION_STATUS_DRAFT). The server
  // requires the committee and the type structure at creation (for
  // income_expense also the direction), so the assistant calls this as soon
  // as those wizard questions are answered.
  abstract createDraft(params: CreateSubmissionParams): Observable<Submission>;

  // Replaces the draft's submission-level answers (committee, type oneof with
  // scope/direction/settlement details, notice) with the given state. Items
  // are sub-resources and are not touched by this update.
  abstract updateDraft(id: string, params: CreateSubmissionParams): Observable<Submission>;

  // Adds a receipt item (submission item sub-resource) to the draft.
  abstract createDraftItem(id: string, params: CreateItemParams): Observable<SubmissionItem>;

  // Replaces a draft item's editable fields (category, document form,
  // description, amount).
  abstract updateDraftItem(id: string, itemId: string, params: CreateItemParams): Observable<SubmissionItem>;

  // Removes a draft item (and with it its attachments).
  abstract removeDraftItem(id: string, itemId: string): Observable<void>;

  // Uploads an attachment (PDF/JPG/PNG) to a draft item via the binary
  // Huma exception API.
  abstract uploadDraftAttachment(id: string, itemId: string, file: File): Observable<Attachment>;

  // Removes an attachment from a draft item.
  abstract removeDraftAttachment(id: string, itemId: string, attachmentId: string): Observable<void>;

  // Transitions a draft to PENDING for review (validates completeness).
  abstract submitSubmission(id: string): Observable<Submission>;

  // Convenience for the dense form: draft + submit in one action.
  abstract createAndSubmitSubmission(params: CreateSubmissionParams): Observable<Submission>;
}
