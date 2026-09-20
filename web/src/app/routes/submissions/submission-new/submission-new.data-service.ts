import { Observable } from 'rxjs';
import {
  Submission,
  SettlementPayload,
  SubmissionDirection,
  SubmissionScope,
  DocumentForm,
} from '../../../shared/models';
import { Committee } from '../../../shared/models';

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
  direction: SubmissionDirection;
  // Null for income submissions (no settlement takes place).
  settlement: SettlementPayload | null;
  scope: SubmissionScope;
  notice: string | null;
  items: CreateItemParams[];
}

export abstract class SubmissionNewDataService {
  abstract getCommitteeOptions(): Observable<Committee[]>;

  // Creates the submission as a server-side draft so no data is lost if the
  // SPA dies mid-flow.
  abstract createSubmissionDraft(params: CreateSubmissionParams): Observable<Submission>;

  // Transitions a draft to PENDING for review (validates completeness).
  abstract submitSubmission(id: string): Observable<Submission>;

  // Convenience for the dense form: draft + submit in one action.
  abstract createAndSubmitSubmission(params: CreateSubmissionParams): Observable<Submission>;
}
