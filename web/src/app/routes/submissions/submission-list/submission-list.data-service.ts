import { Observable } from 'rxjs';
import { Submission, SubmissionStatus, SubmissionDirection } from '../../../shared/models';
import { Committee } from '../../../shared/models';

export abstract class SubmissionListDataService {
  abstract getSubmissions(filters?: {
    status?: SubmissionStatus;
    committeeId?: string;
    direction?: SubmissionDirection;
    // Include the current user's drafts (e.g. "Meine Entwürfe" view).
    includeOwnDrafts?: boolean;
  }): Observable<Submission[]>;

  abstract getCommittees(): Observable<Committee[]>;

  abstract deleteSubmission(id: string): Observable<void>;
}
