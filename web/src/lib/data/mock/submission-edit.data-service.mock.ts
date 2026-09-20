import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { faker } from '@faker-js/faker/locale/de';
import {
  Submission,
  SubmissionComment,
  SubmissionAuditEntry,
  SubmissionStatus,
  SubmissionItem,
  Attachment,
} from '../../../app/shared/models';
import { Committee } from '../../../app/shared/models';
import {
  SubmissionEditDataService,
  UpdateSubmissionParams,
  AddItemParams,
  UpdateItemParams,
  AddCommentParams,
} from '../../../app/routes/submissions/submission-edit/submission-edit.data-service';

const COMMITTEES: Committee[] = [
  {
    id: 'committee-asta',
    name: 'AStA',
    description: 'Allgemeiner Studierendenausschuss',
    isActive: true,
    allowScopeSelection: true,
    paymentAccounts: [{ uid: 'acc-asta-bank', kind: 'bank_account', label: 'Gremiumskonto AStA' }],
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  },
];

@Injectable()
export class MockSubmissionEditDataService extends SubmissionEditDataService {
  private submissions: Map<string, Submission> = new Map();
  private comments: Map<string, SubmissionComment[]> = new Map();
  private auditLogs: Map<string, SubmissionAuditEntry[]> = new Map();

  getSubmission(id: string): Observable<Submission> {
    if (!this.submissions.has(id)) {
      this.submissions.set(id, this.generateSubmission(id));
      this.comments.set(id, this.generateComments(id));
      this.auditLogs.set(id, this.generateAuditLog(id));
    }
    return of(this.submissions.get(id)!).pipe(delay(300));
  }

  updateSubmission(id: string, params: UpdateSubmissionParams): Observable<Submission> {
    const submission = this.submissions.get(id);
    if (submission) {
      Object.assign(submission, params);
      submission.updatedAt = new Date();
      this.addAuditEntry(id, 'update', 'submission', null, JSON.stringify(params));
    }
    return of(submission!).pipe(delay(300));
  }

  changeStatus(id: string, newStatus: SubmissionStatus, comment?: string): Observable<Submission> {
    const submission = this.submissions.get(id);
    if (submission) {
      const oldStatus = submission.status;
      submission.status = newStatus;
      submission.updatedAt = new Date();
      this.addAuditEntry(id, 'status_change', 'status', oldStatus, newStatus);

      if (comment) {
        this.addCommentInternal(
          id,
          { content: comment, isAdminOnly: false },
          { from: oldStatus, to: newStatus }
        );
      }
    }
    return of(submission!).pipe(delay(300));
  }

  addItem(submissionId: string, params: AddItemParams): Observable<SubmissionItem> {
    const submission = this.submissions.get(submissionId);
    const item: SubmissionItem = {
      id: faker.string.uuid(),
      publicId: `${submission?.publicId ?? ''}/${(submission?.items.length ?? 0) + 1}`,
      submissionId,
      category: params.category,
      documentForm: params.documentForm,
      source: params.source,
      description: params.description,
      amount: params.amount,
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      originalReceived: false,
      originalReceivedAt: null,
      originalReceivedByUserId: null,
      originalReceivedByUserName: null,
    };
    if (submission) {
      submission.items.push(item);
      submission.totalAmount = submission.items.reduce((sum, i) => sum + i.amount, 0);
      submission.updatedAt = new Date();
      this.addAuditEntry(submissionId, 'create', 'item', null, item.publicId);
    }
    return of(item).pipe(delay(300));
  }

  updateItem(submissionId: string, itemId: string, params: UpdateItemParams): Observable<SubmissionItem> {
    const submission = this.submissions.get(submissionId);
    const item = submission?.items.find((i) => i.id === itemId);
    if (item) {
      Object.assign(item, params);
      item.updatedAt = new Date();
      if (submission) {
        submission.totalAmount = submission.items.reduce((sum, i) => sum + i.amount, 0);
        submission.updatedAt = new Date();
      }
    }
    return of(item!).pipe(delay(300));
  }

  deleteItem(submissionId: string, itemId: string): Observable<void> {
    const submission = this.submissions.get(submissionId);
    if (submission) {
      const item = submission.items.find((i) => i.id === itemId);
      submission.items = submission.items.filter((i) => i.id !== itemId);
      submission.totalAmount = submission.items.reduce((sum, i) => sum + i.amount, 0);
      submission.updatedAt = new Date();
      this.addAuditEntry(submissionId, 'delete', 'item', item?.publicId ?? null, null);
    }
    return of(undefined).pipe(delay(300));
  }

  uploadAttachment(submissionId: string, itemId: string, file: File): Observable<Attachment> {
    const submission = this.submissions.get(submissionId);
    const item = submission?.items.find((i) => i.id === itemId);
    const attachment: Attachment = {
      id: faker.string.uuid(),
      submissionItemId: itemId,
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      fileSize: file.size,
      storageKey: faker.string.uuid(),
      uploadedAt: new Date(),
    };
    item?.attachments.push(attachment);
    return of(attachment).pipe(delay(400));
  }

  deleteAttachment(submissionId: string, itemId: string, attachmentId: string): Observable<void> {
    const submission = this.submissions.get(submissionId);
    const item = submission?.items.find((i) => i.id === itemId);
    if (item) {
      item.attachments = item.attachments.filter((a) => a.id !== attachmentId);
    }
    return of(undefined).pipe(delay(300));
  }

  confirmOriginalReceived(submissionId: string, itemId: string): Observable<SubmissionItem> {
    const submission = this.submissions.get(submissionId);
    const item = submission?.items.find((i) => i.id === itemId);
    if (item) {
      item.originalReceived = true;
      item.originalReceivedAt = new Date();
      item.originalReceivedByUserId = faker.string.uuid();
      item.originalReceivedByUserName = faker.person.fullName();
    }
    return of(item!).pipe(delay(300));
  }

  getComments(submissionId: string): Observable<SubmissionComment[]> {
    if (!this.comments.has(submissionId)) {
      this.comments.set(submissionId, this.generateComments(submissionId));
    }
    return of(this.comments.get(submissionId)!).pipe(delay(250));
  }

  addComment(submissionId: string, params: AddCommentParams): Observable<SubmissionComment> {
    const comment = this.addCommentInternal(submissionId, params, null);
    return of(comment).pipe(delay(300));
  }

  getAuditLog(submissionId: string): Observable<SubmissionAuditEntry[]> {
    if (!this.auditLogs.has(submissionId)) {
      this.auditLogs.set(submissionId, this.generateAuditLog(submissionId));
    }
    return of(this.auditLogs.get(submissionId)!).pipe(delay(250));
  }

  getCommittees(): Observable<Committee[]> {
    return of(COMMITTEES.map((c) => ({ ...c }))).pipe(delay(200));
  }

  private addCommentInternal(
    submissionId: string,
    params: AddCommentParams,
    statusChange: { from: SubmissionStatus; to: SubmissionStatus } | null
  ): SubmissionComment {
    const comment: SubmissionComment = {
      id: faker.string.uuid(),
      submissionId,
      authorUserId: faker.string.uuid(),
      authorUserFullName: faker.person.fullName(),
      content: params.content,
      isAdminOnly: params.isAdminOnly,
      statusChange,
      createdAt: new Date(),
    };
    if (!this.comments.has(submissionId)) {
      this.comments.set(submissionId, []);
    }
    this.comments.get(submissionId)!.push(comment);
    return comment;
  }

  private addAuditEntry(
    submissionId: string,
    action: string,
    fieldName: string | null,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (!this.auditLogs.has(submissionId)) {
      this.auditLogs.set(submissionId, []);
    }
    this.auditLogs.get(submissionId)!.push({
      id: faker.string.uuid(),
      submissionId,
      actorUserId: faker.string.uuid(),
      actorUserFullName: faker.person.fullName(),
      action,
      fieldName,
      oldValue,
      newValue,
      timestamp: new Date(),
    });
  }

  private generateComments(submissionId: string): SubmissionComment[] {
    return [
      {
        id: faker.string.uuid(),
        submissionId,
        authorUserId: faker.string.uuid(),
        authorUserFullName: faker.person.fullName(),
        content: 'Bitte hänge noch den Kassenbon an.',
        isAdminOnly: false,
        statusChange: null,
        createdAt: faker.date.recent(),
      },
      {
        id: faker.string.uuid(),
        submissionId,
        authorUserId: faker.string.uuid(),
        authorUserFullName: faker.person.fullName(),
        content: 'Interne Notiz: Posten geprüft.',
        isAdminOnly: true,
        statusChange: null,
        createdAt: faker.date.recent(),
      },
    ];
  }

  private generateAuditLog(submissionId: string): SubmissionAuditEntry[] {
    return [
      {
        id: faker.string.uuid(),
        submissionId,
        actorUserId: faker.string.uuid(),
        actorUserFullName: faker.person.fullName(),
        action: 'create',
        fieldName: null,
        oldValue: null,
        newValue: null,
        timestamp: faker.date.recent(),
      },
      {
        id: faker.string.uuid(),
        submissionId,
        actorUserId: faker.string.uuid(),
        actorUserFullName: faker.person.fullName(),
        action: 'submit',
        fieldName: 'status',
        oldValue: 'draft',
        newValue: 'pending',
        timestamp: faker.date.recent(),
      },
    ];
  }

  private generateSubmission(id: string): Submission {
    const year = new Date().getFullYear();
    const items = Array.from({ length: 2 }, (_, j) => ({
      id: faker.string.uuid(),
      publicId: `${year}/01/${j + 1}`,
      submissionId: id,
      category: 'rechnung',
      documentForm: 'paper_original' as const,
      source: null,
      description: faker.commerce.productName(),
      amount: faker.number.int({ min: 500, max: 20000 }),
      attachments: [] as Attachment[],
      createdAt: faker.date.recent(),
      updatedAt: faker.date.recent(),
      originalReceived: false,
      originalReceivedAt: null,
      originalReceivedByUserId: null,
      originalReceivedByUserName: null,
    }));

    return {
      id,
      publicId: `${year}/01`,
      createdAt: faker.date.recent(),
      updatedAt: faker.date.recent(),
      createdByUserId: faker.string.uuid(),
      createdByUserFullName: faker.person.fullName(),
      committeeId: 'committee-asta',
      committeeName: 'AStA',
      direction: 'expense',
      settlement: 'person',
      scope: 'hoheitlich',
      status: 'pending',
      notice: null,
      personSettlement: {
        payoutMethod: 'bank_transfer',
        bankDetails: {
          accountHolder: faker.person.fullName(),
          iban: faker.finance.iban({ countryCode: 'DE' }),
          bic: faker.finance.bic(),
        },
      },
      committeeAccountSettlement: null,
      paymentRequestSettlement: null,
      completionPaidDate: null,
      completionPaymentReference: null,
      items,
      totalAmount: items.reduce((sum, i) => sum + i.amount, 0),
    };
  }
}
