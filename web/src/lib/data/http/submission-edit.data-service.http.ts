import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import {
  CommitteeServiceService,
  SubmissionCommentServiceService,
  SubmissionItemServiceService,
  SubmissionServiceService,
} from '../../api/services';
import { environment } from '../../../environments/environment';
import { CurrentOrganizationService } from '../../../app/shared/services/current-organization.service';
import {
  Submission,
  SubmissionComment,
  SubmissionAuditEntry,
  SubmissionStatus,
  SubmissionItem,
  Attachment,
  Committee,
} from '../../../app/shared/models';
import { mapApiCommittee, mapApiSubmission, mapApiSubmissionComment, mapApiSubmissionItem, uidFromResourceName } from './submission-mapper';
import { SubmissionEditDataService, UpdateSubmissionParams, AddItemParams, UpdateItemParams, AddCommentParams } from '../../../app/routes/submissions/submission-edit/submission-edit.data-service';

@Injectable()
export class HttpSubmissionEditDataService extends SubmissionEditDataService {
  private readonly http = inject(HttpClient);
  private readonly committeeSvc = inject(CommitteeServiceService);
  private readonly submissionSvc = inject(SubmissionServiceService);
  private readonly itemSvc = inject(SubmissionItemServiceService);
  private readonly commentSvc = inject(SubmissionCommentServiceService);
  private readonly currentOrganization = inject(CurrentOrganizationService);

  private get organizationId(): string {
    return this.currentOrganization.currentOrganizationId() ?? '';
  }

  private get parent(): string {
    return `organizations/${this.organizationId}`;
  }

  private submissionName(id: string): string {
    return `${this.parent}/submissions/${id}`;
  }

  /** Binary attachment API origin (Huma exception endpoints). */
  private get apiOrigin(): string {
    return environment.apiBaseUrl.replace(/\/api\/?$/, '');
  }

  private attachmentsUrl(submissionId: string, itemId: string): string {
    return `${this.apiOrigin}/api/v1/organizations/${this.organizationId}/submissions/${submissionId}/items/${itemId}/attachments`;
  }

  getSubmission(id: string): Observable<Submission> {
    return this.submissionSvc.SubmissionServiceGetSubmission(this.submissionName(id)).pipe(
      map(mapApiSubmission),
      map((submission) => ({ ...submission, committeeName: submission.committeeName || '' }))
    );
  }

  updateSubmission(id: string, params: UpdateSubmissionParams): Observable<Submission> {
    return this.submissionSvc.SubmissionServiceGetSubmission(this.submissionName(id)).pipe(
      map((current) => {
        const submission: Record<string, unknown> = {
          name: this.submissionName(id),
          notice: params.notice ?? current.notice ?? '',
        };
        const mask: string[] = ['notice'];
        if (params.scope !== undefined) {
          submission['scope'] = `SCOPE_${params.scope === 'gewerblich' ? 'COMMERCIAL' : 'NONPROFIT'}`;
          mask.push('scope');
        }
        return { submission, updateMask: mask };
      }),
      map((body) => this.submissionSvc.SubmissionServiceUpdateSubmission(body as never)),
      map((result) => mapApiSubmission(result as never))
    );
  }

  changeStatus(id: string, newStatus: SubmissionStatus, comment?: string): Observable<Submission> {
    const name = this.submissionName(id);
    switch (newStatus) {
      case 'pending':
        return this.submissionSvc
          .SubmissionServiceSubmitSubmission({ name, body: {} })
          .pipe(map(mapApiSubmission));
      case 'approved':
        return this.submissionSvc
          .SubmissionServiceApproveSubmission({ name, body: { note: comment ?? '' } })
          .pipe(map(mapApiSubmission));
      case 'rejected':
        return this.submissionSvc
          .SubmissionServiceRejectSubmission({ name, body: { reason: comment ?? '' } })
          .pipe(map(mapApiSubmission));
      case 'further_info_required':
        return this.submissionSvc
          .SubmissionServiceRequestFurtherInfo({ name, body: { reason: comment ?? '' } })
          .pipe(map(mapApiSubmission));
      case 'completed':
        return this.submissionSvc
          .SubmissionServiceCompleteSubmission({ name, body: {} })
          .pipe(map(mapApiSubmission));
      default:
        return throwError(() => new Error(`unsupported status transition: ${newStatus}`));
    }
  }

  addItem(submissionId: string, params: AddItemParams): Observable<SubmissionItem> {
    return this.itemSvc
      .SubmissionItemServiceCreateSubmissionItem({
        parent: this.submissionName(submissionId),
        item: {
          category: params.category,
          document_form: `DOCUMENT_FORM_${params.documentForm.toUpperCase()}` as never,
          source: params.source ?? '',
          description: params.description ?? '',
          amount: { value: (params.amount / 100).toFixed(2) },
        },
      })
      .pipe(
        map((item) => {
          const mapped = mapApiSubmissionItem(item);
          return { ...mapped, submissionId };
        })
      );
  }

  updateItem(submissionId: string, itemId: string, params: UpdateItemParams): Observable<SubmissionItem> {
    const mask: string[] = [];
    const item: Record<string, unknown> = {
      name: `${this.submissionName(submissionId)}/items/${itemId}`,
      amount: { value: '0' },
    };
    if (params.category !== undefined) {
      item['category'] = params.category;
      mask.push('category');
    }
    if (params.description !== undefined) {
      item['description'] = params.description ?? '';
      mask.push('description');
    }
    if (params.source !== undefined) {
      item['source'] = params.source ?? '';
      mask.push('source');
    }
    if (params.amount !== undefined) {
      item['amount'] = { value: (params.amount / 100).toFixed(2) };
      mask.push('amount');
    }
    return this.itemSvc
      .SubmissionItemServiceUpdateSubmissionItem({
        itemName: `${this.submissionName(submissionId)}/items/${itemId}`,
        item: item as never,
        update_mask: mask,
      } as never)
      .pipe(map(mapApiSubmissionItem));
  }

  deleteItem(submissionId: string, itemId: string): Observable<void> {
    return this.itemSvc
      .SubmissionItemServiceDeleteSubmissionItem(`${this.submissionName(submissionId)}/items/${itemId}`)
      .pipe(map(() => undefined));
  }

  uploadAttachment(submissionId: string, itemId: string, file: File): Observable<Attachment> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<AttachmentBody>(this.attachmentsUrl(submissionId, itemId), formData)
      .pipe(map(attachmentFromBody));
  }

  deleteAttachment(submissionId: string, itemId: string, attachmentId: string): Observable<void> {
    return this.http
      .delete(`${this.attachmentsUrl(submissionId, itemId)}/${attachmentId}`)
      .pipe(map(() => undefined));
  }

  confirmOriginalReceived(_submissionId: string, _itemId: string): Observable<SubmissionItem> {
    // No backend endpoint yet: original-receipt confirmation is designed but
    // not implemented.
    return throwError(() => new Error('not yet implemented'));
  }

  getComments(submissionId: string): Observable<SubmissionComment[]> {
    return this.commentSvc
      .SubmissionCommentServiceListSubmissionComments({
        parent: this.submissionName(submissionId),
        pageSize: 100,
      })
      .pipe(map((resp) => (resp.comments ?? []).map(mapApiSubmissionComment)));
  }

  addComment(submissionId: string, params: AddCommentParams): Observable<SubmissionComment> {
    return this.commentSvc
      .SubmissionCommentServiceCreateSubmissionComment({
        parent: this.submissionName(submissionId),
        comment: {
          content: params.content,
          is_admin_only: params.isAdminOnly,
        },
      })
      .pipe(map(mapApiSubmissionComment));
  }

  getAuditLog(_submissionId: string): Observable<SubmissionAuditEntry[]> {
    // The generic audit log can be wired here once filtering by submission
    // resource name is exposed to the SPA; an empty feed keeps the view
    // functional meanwhile.
    return new Observable((subscriber) => {
      subscriber.next([]);
      subscriber.complete();
    });
  }

  getCommittees(): Observable<Committee[]> {
    return this.committeeSvc
      .CommitteeServiceListCommittees({ parent: this.parent, pageSize: 100 })
      .pipe(map((resp) => (resp.committees ?? []).map(mapApiCommittee)));
  }
}

interface AttachmentBody {
  id: string;
  submission_item_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  create_time: string;
}

function attachmentFromBody(body: AttachmentBody): Attachment {
  return {
    id: body.id,
    submissionItemId: body.submission_item_id,
    fileName: body.file_name,
    mimeType: body.mime_type,
    fileSize: body.file_size,
    storageKey: '',
    uploadedAt: body.create_time ? new Date(body.create_time) : new Date(),
  };
}

void uidFromResourceName;
