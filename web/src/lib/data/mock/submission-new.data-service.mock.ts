import { Injectable } from '@angular/core';
import { mockCurrentUserCommittees } from './_shared-committee-data';
import { Observable, of, delay } from 'rxjs';
import { faker } from '@faker-js/faker/locale/de';
import { Attachment, Submission, SubmissionItem } from '../../../app/shared/models';
import { Committee } from '../../../app/shared/models';
import {
  SubmissionNewDataService,
  CreateSubmissionParams,
  CreateItemParams,
} from '../../../app/routes/submissions/submission-new/submission-new.data-service';

@Injectable()
export class MockSubmissionNewDataService extends SubmissionNewDataService {
  private publicIdCounter = 20;
  private committees: Committee[] = [
    {
      id: 'committee-asta',
      name: 'AStA',
      description: 'Allgemeiner Studierendenausschuss',
      isActive: true,
      allowScopeSelection: true,
      paymentAccounts: [
        { uid: 'acc-asta-bank', kind: 'bank_account', label: 'Gremiumskonto AStA' },
      ],
      isReferenced: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    },
    {
      id: 'committee-stupa',
      name: 'StuPa',
      description: 'Studierendenparlament',
      isActive: true,
      allowScopeSelection: false,
      paymentAccounts: [],
      isReferenced: false,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    },
    {
      id: 'committee-kultur',
      name: 'Kulturreferat',
      description: 'Referat für Hochschulkultur',
      isActive: true,
      allowScopeSelection: false,
      paymentAccounts: [
        { uid: 'acc-kultur-cash', kind: 'cash_box', label: 'Kasse Kulturreferat' },
      ],
      isReferenced: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    },
  ];

  // In-memory draft store so the assistant can create a draft early and
  // update it (plus its items/attachments) step by step.
  private drafts = new Map<string, Submission>();

  // Mirrors the ListUserCommittees endpoint: only committees the current
  // user is a member of can be picked for new submissions.
  getCommitteeOptions(): Observable<Committee[]> {
    return of(mockCurrentUserCommittees().map((c) => ({ ...c, paymentAccounts: c.paymentAccounts.map((pa) => ({ ...pa })) }))).pipe(
      delay(200)
    );
  }

  createDraft(params: CreateSubmissionParams): Observable<Submission> {
    const draft = this.buildSubmission(params, 'draft');
    this.drafts.set(draft.id, draft);
    return of({ ...draft, items: draft.items.map((i) => ({ ...i })) }).pipe(delay(250));
  }

  updateDraft(id: string, params: CreateSubmissionParams): Observable<Submission> {
    const draft = this.getDraft(id);
    const committee = this.committeeById(params.committeeId);
    draft.committeeId = committee.id;
    draft.committeeName = committee.name;
    draft.type = params.type;
    draft.direction = params.direction;
    draft.settlement = params.settlement?.kind ?? null;
    draft.scope = params.scope;
    draft.notice = params.notice;
    this.applySettlement(draft, params, committee);
    return of(this.clone(draft)).pipe(delay(200));
  }

  createDraftItem(id: string, params: CreateItemParams): Observable<SubmissionItem> {
    const draft = this.getDraft(id);
    const item = this.buildItem(params, draft);
    draft.items.push(item);
    this.recalculateTotal(draft);
    return of({ ...item }).pipe(delay(200));
  }

  updateDraftItem(id: string, itemId: string, params: CreateItemParams): Observable<SubmissionItem> {
    const draft = this.getDraft(id);
    const item = draft.items.find((i) => i.id === itemId);
    if (!item) {
      return of(this.buildItem(params, draft)).pipe(delay(200));
    }
    item.category = params.category;
    item.documentForm = params.documentForm;
    item.source = params.source;
    item.description = params.description;
    item.amount = params.amount;
    this.recalculateTotal(draft);
    return of({ ...item }).pipe(delay(200));
  }

  removeDraftItem(id: string, itemId: string): Observable<void> {
    const draft = this.getDraft(id);
    draft.items = draft.items.filter((i) => i.id !== itemId);
    this.recalculateTotal(draft);
    return of(undefined).pipe(delay(200));
  }

  uploadDraftAttachment(id: string, itemId: string, file: File): Observable<Attachment> {
    const draft = this.getDraft(id);
    const item = draft.items.find((i) => i.id === itemId);
    const attachment: Attachment = {
      id: faker.string.uuid(),
      submissionItemId: itemId,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      storageKey: '',
      uploadedAt: new Date(),
    };
    item?.attachments.push(attachment);
    return of({ ...attachment }).pipe(delay(300));
  }

  removeDraftAttachment(id: string, itemId: string, attachmentId: string): Observable<void> {
    const draft = this.getDraft(id);
    const item = draft.items.find((i) => i.id === itemId);
    if (item) {
      item.attachments = item.attachments.filter((a) => a.id !== attachmentId);
    }
    return of(undefined).pipe(delay(150));
  }

  submitSubmission(id: string): Observable<Submission> {
    const draft = this.getDraft(id);
    draft.status = 'pending';
    return of(this.clone(draft)).pipe(delay(250));
  }

  createAndSubmitSubmission(params: CreateSubmissionParams): Observable<Submission> {
    const draft = this.buildSubmission(params, 'pending');
    this.drafts.set(draft.id, draft);
    return of(this.clone(draft)).pipe(delay(300));
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private getDraft(id: string): Submission {
    const draft = this.drafts.get(id);
    if (!draft) {
      throw new Error(`draft ${id} not found`);
    }
    return draft;
  }

  private clone(draft: Submission): Submission {
    return {
      ...draft,
      items: draft.items.map((i) => ({ ...i, attachments: i.attachments.map((a) => ({ ...a })) })),
    };
  }

  private committeeById(id: string): Committee {
    return this.committees.find((c) => c.id === id) ?? this.committees[0];
  }

  private applySettlement(
    draft: Submission,
    params: CreateSubmissionParams,
    committee: Committee
  ): void {
    const settlement = params.settlement;
    draft.personSettlement =
      settlement?.kind === 'person'
        ? { payoutMethod: settlement.payoutMethod, bankDetails: settlement.bankDetails }
        : null;
    draft.committeeAccountSettlement =
      settlement?.kind === 'committee_account'
        ? {
            paymentAccountUid: settlement.paymentAccountUid,
            paymentAccountLabel:
              committee.paymentAccounts.find((pa) => pa.uid === settlement.paymentAccountUid)?.label ?? '',
            paidDate: settlement.paidDate,
            paymentReference: settlement.paymentReference,
          }
        : null;
    draft.paymentRequestSettlement =
      settlement?.kind === 'payment_request'
        ? { bankDetails: settlement.bankDetails }
        : null;
  }

  private nextPublicId(): string {
    const year = new Date().getFullYear();
    this.publicIdCounter++;
    return `${year}/${String(this.publicIdCounter).padStart(2, '0')}`;
  }

  private buildItem(
    params: CreateItemParams,
    submission: Pick<Submission, 'id' | 'publicId' | 'items'>
  ): SubmissionItem {
    return {
      id: faker.string.uuid(),
      publicId: `${submission.publicId}/${submission.items.length + 1}`,
      submissionId: submission.id,
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
  }

  private recalculateTotal(draft: Submission): void {
    draft.totalAmount = draft.items.reduce((sum, item) => sum + item.amount, 0);
  }

  private buildSubmission(params: CreateSubmissionParams, status: 'draft' | 'pending'): Submission {
    const committee = this.committeeById(params.committeeId);
    const newSubmission: Submission = {
      id: faker.string.uuid(),
      publicId: this.nextPublicId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserId: faker.string.uuid(),
      createdByUserFullName: faker.person.fullName(),
      committeeId: committee.id,
      committeeName: committee.name,
      type: params.type,
      direction: params.direction,
      settlement: params.settlement?.kind ?? null,
      scope: params.scope,
      status,
      notice: params.notice,
      personSettlement: null,
      committeeAccountSettlement: null,
      paymentRequestSettlement: null,
      completionPaidDate: null,
      completionPaymentReference: null,
      items: [],
      totalAmount: 0,
    };
    this.applySettlement(newSubmission, params, committee);
    newSubmission.items = params.items.map((item) => this.buildItem(item, newSubmission));
    this.recalculateTotal(newSubmission);
    return newSubmission;
  }
}
