import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CommitteeServiceService } from '../../api/services/committee-service.service';
import { SubmissionServiceService } from '../../api/services/submission-service.service';
import { CurrentOrganizationService } from '../../../app/shared/services/current-organization.service';
import { Committee, Submission, SubmissionStatus, SubmissionDirection } from '../../../app/shared/models';
import { mapApiCommittee, mapApiSubmission } from './submission-mapper';
import { SubmissionListDataService } from '../../../app/routes/submissions/submission-list/submission-list.data-service';

function enumValue(prefix: string, value: string): string {
  return `${prefix}_${value.toUpperCase()}`;
}

@Injectable()
export class HttpSubmissionListDataService extends SubmissionListDataService {
  private readonly committeeSvc = inject(CommitteeServiceService);
  private readonly submissionSvc = inject(SubmissionServiceService);
  private readonly currentOrganization = inject(CurrentOrganizationService);

  private get parent(): string {
    return `organizations/${this.currentOrganization.currentOrganizationId() ?? ''}`;
  }

  getSubmissions(filters?: {
    status?: SubmissionStatus;
    committeeId?: string;
    direction?: SubmissionDirection;
    includeOwnDrafts?: boolean;
  }): Observable<Submission[]> {
    const filterParts: string[] = [];
    if (filters?.status) {
      filterParts.push(`status = "${enumValue('SUBMISSION_STATUS', filters.status)}"`);
    }
    if (filters?.committeeId) {
      filterParts.push(
        `committee = "organizations/${this.currentOrganization.currentOrganizationId() ?? ''}/committees/${filters.committeeId}"`
      );
    }
    if (filters?.direction) {
      filterParts.push(`direction = "${enumValue('DIRECTION', filters.direction)}"`);
    }

    return this.submissionSvc
      .SubmissionServiceListSubmissions({
        parent: this.parent,
        pageSize: 100,
        filter: filterParts.length ? filterParts.join(' AND ') : undefined,
      })
      .pipe(map((resp) => (resp.submissions ?? []).map(mapApiSubmission)));
  }

  getCommittees(): Observable<Committee[]> {
    return this.committeeSvc
      .CommitteeServiceListCommittees({ parent: this.parent, pageSize: 100 })
      .pipe(map((resp) => (resp.committees ?? []).map(mapApiCommittee)));
  }

  deleteSubmission(id: string): Observable<void> {
    return this.submissionSvc
      .SubmissionServiceDeleteSubmission(
        `organizations/${this.currentOrganization.currentOrganizationId() ?? ''}/submissions/${id}`
      )
      .pipe(map(() => undefined));
  }
}
