import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, map, of, switchMap } from 'rxjs';
import { CommitteeServiceService } from '../../api/services/committee-service.service';
import { CommitteePaymentAccountServiceService } from '../../api/services/committee-payment-account-service.service';
import { SubmissionServiceService } from '../../api/services/submission-service.service';
import { SubmissionItemServiceService } from '../../api/services/submission-item-service.service';
import { V1Submission } from '../../api/models/v1submission';
import { V1SubmissionItem } from '../../api/models/v1submission-item';
import { V1SubmissionTypeIncomeExpenseDetails } from '../../api/models/v1submission-type-income-expense-details';
import { V1SubmissionDirectionExpenseDetails } from '../../api/models/v1submission-direction-expense-details';
import { V1SubmissionSettlementPerson } from '../../api/models/v1submission-settlement-person';
import { V1SubmissionSettlementCommitteeAccount } from '../../api/models/v1submission-settlement-committee-account';
import { V1BankAccount } from '../../api/models/v1bank-account';
import { TypeDate } from '../../api/models/type-date';
import { environment } from '../../../environments/environment';
import { CurrentOrganizationService } from '../../../app/shared/services/current-organization.service';
import {
  Attachment,
  Committee,
  Submission,
  SubmissionItem,
} from '../../../app/shared/models';
import {
  mapApiCommittee,
  mapApiCommitteePaymentAccount,
  mapApiSubmission,
  mapApiSubmissionItem,
} from './submission-mapper';
import {
  SubmissionNewDataService,
  CreateSubmissionParams,
  CreateItemParams,
} from '../../../app/routes/submissions/submission-new/submission-new.data-service';
import { SettlementPayload } from '../../../app/shared/models/submission.model';

function bankAccountToProto(ba: {
  accountHolder: string;
  iban: string;
  bic: string | null;
  accountNumber: string | null;
}): V1BankAccount {
  return {
    account_holder: ba.accountHolder ?? '',
    iban: ba.iban ?? '',
    bic: ba.bic ?? undefined,
    account_number: ba.accountNumber ?? undefined,
  };
}

function dateToApi(d: Date | null): TypeDate {
  if (!d) return { year: 0, month: 0, day: 0 };
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

// Maps the UI settlement payload onto the proto settlement oneof branch of
// the expense direction details.
function settlementToProto(
  parent: string,
  committeeId: string,
  settlement: SettlementPayload
):
  | { person: V1SubmissionSettlementPerson }
  | { committee_account: V1SubmissionSettlementCommitteeAccount }
  | { payment_request: { bank_account: V1BankAccount } } {
  switch (settlement.kind) {
    case 'person':
      return {
        person: {
          bank_transfer:
            settlement.payoutMethod === 'bank_transfer' && settlement.bankDetails
              ? { bank_account: bankAccountToProto(settlement.bankDetails) }
              : undefined,
          cash: settlement.payoutMethod === 'cash' ? {} : undefined,
        },
      };
    case 'committee_account':
      return {
        committee_account: {
          payment_account: `${parent}/committees/${committeeId}/paymentAccounts/${settlement.paymentAccountUid}`,
          paid_date: dateToApi(settlement.paidDate),
          payment_reference: settlement.paymentReference ?? undefined,
        },
      };
    case 'payment_request':
      return {
        payment_request: { bank_account: bankAccountToProto(settlement.bankDetails) },
      };
  }
}

function submissionToProto(parent: string, params: CreateSubmissionParams): V1Submission {
  const body: V1Submission = {
    committee: `${parent}/committees/${params.committeeId}`,
    notice: params.notice ?? '',
  };
  if (params.type === 'misc') {
    body.misc = {};
    return body;
  }

  const details: V1SubmissionTypeIncomeExpenseDetails = {
    // Null means "not answered yet" (drafts): keep the scope unspecified so
    // the submitter can still pick one later (the server locks the scope
    // once a concrete value is stored). Committees without
    // allow_scope_selection get NONPROFIT forced server-side.
    scope:
      params.scope === 'gewerblich'
        ? 'SUBMISSION_SCOPE_COMMERCIAL'
        : params.scope === 'hoheitlich'
          ? 'SUBMISSION_SCOPE_NONPROFIT'
          : 'SUBMISSION_SCOPE_UNSPECIFIED',
  };
  if (params.direction === 'income') {
    details.income = {};
    body.income_expense = details;
    return body;
  }
  // An expense without a settlement payload is a valid draft state
  // ("settlement not picked yet"); the details follow once answered.
  details.expense = params.settlement
    ? ({
        ...settlementToProto(parent, params.committeeId, params.settlement),
      } as V1SubmissionDirectionExpenseDetails)
    : {};
  body.income_expense = details;
  return body;
}

function itemToProto(params: CreateItemParams): V1SubmissionItem {
  return {
    category: params.category,
    document_form: `DOCUMENT_FORM_${params.documentForm.toUpperCase()}` as never,
    source: params.source ?? '',
    description: params.description ?? '',
    amount: { value: (params.amount / 100).toFixed(2) },
  };
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

@Injectable()
export class HttpSubmissionNewDataService extends SubmissionNewDataService {
  private readonly committeeSvc = inject(CommitteeServiceService);
  private readonly paymentAccountSvc = inject(CommitteePaymentAccountServiceService);
  private readonly submissionSvc = inject(SubmissionServiceService);
  private readonly itemSvc = inject(SubmissionItemServiceService);
  private readonly http = inject(HttpClient);
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

  // Only the committees the current user is a member of can be picked for
  // new submissions. The payment accounts live on a sub-resource and are
  // attached per committee (they gate the committee-account settlement).
  getCommitteeOptions(): Observable<Committee[]> {
    return this.committeeSvc
      .CommitteeServiceListUserCommittees({ parent: this.parent, pageSize: 100 })
      .pipe(
        switchMap((resp) => {
          const committees = (resp.committees ?? []).map(mapApiCommittee);
          if (committees.length === 0) {
            return of(committees);
          }
          return forkJoin(
            committees.map((committee) =>
              this.paymentAccountSvc
                .CommitteePaymentAccountServiceListCommitteePaymentAccounts({
                  parent: `${this.parent}/committees/${committee.id}`,
                  pageSize: 100,
                })
                .pipe(
                  map((accounts) => ({
                    ...committee,
                    paymentAccounts: (accounts.payment_accounts ?? []).map(
                      mapApiCommitteePaymentAccount
                    ),
                  })),
                ),
            ),
          );
        }),
      );
  }

  createDraft(params: CreateSubmissionParams): Observable<Submission> {
    // The server persists the full type structure (direction, settlement and
    // its details) on create; drafts may stay incomplete until :submit.
    return this.submissionSvc
      .SubmissionServiceCreateSubmission({
        parent: this.parent,
        submission: submissionToProto(this.parent, params),
      })
      .pipe(map(mapApiSubmission));
  }

  updateDraft(id: string, params: CreateSubmissionParams): Observable<Submission> {
    const name = this.submissionName(id);
    // The generated client cannot transmit a field mask, so the update is a
    // full replace of the mutable fields; the loaded etag guards concurrency.
    return this.submissionSvc.SubmissionServiceGetSubmission(name).pipe(
      switchMap((current) =>
        this.submissionSvc.SubmissionServiceUpdateSubmission({
          submissionName: name,
          submission: {
            ...submissionToProto(this.parent, params),
            etag: current.etag,
          },
        }),
      ),
      map(mapApiSubmission),
    );
  }

  createDraftItem(id: string, params: CreateItemParams): Observable<SubmissionItem> {
    return this.itemSvc
      .SubmissionItemServiceCreateSubmissionItem({
        parent: this.submissionName(id),
        item: itemToProto(params),
      })
      .pipe(map(mapApiSubmissionItem));
  }

  updateDraftItem(id: string, itemId: string, params: CreateItemParams): Observable<SubmissionItem> {
    const itemName = `${this.submissionName(id)}/items/${itemId}`;
    // Full replace: load the item, apply the editable changes and send it back.
    return this.itemSvc.SubmissionItemServiceGetSubmissionItem(itemName).pipe(
      switchMap((current) =>
        this.itemSvc.SubmissionItemServiceUpdateSubmissionItem({
          itemName,
          item: { ...current, ...itemToProto(params) },
        }),
      ),
      map(mapApiSubmissionItem),
    );
  }

  removeDraftItem(id: string, itemId: string): Observable<void> {
    return this.itemSvc
      .SubmissionItemServiceDeleteSubmissionItem(`${this.submissionName(id)}/items/${itemId}`)
      .pipe(map(() => undefined));
  }

  uploadDraftAttachment(id: string, itemId: string, file: File): Observable<Attachment> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<AttachmentBody>(this.attachmentsUrl(id, itemId), formData)
      .pipe(map(attachmentFromBody));
  }

  removeDraftAttachment(id: string, itemId: string, attachmentId: string): Observable<void> {
    return this.http
      .delete(`${this.attachmentsUrl(id, itemId)}/${attachmentId}`)
      .pipe(map(() => undefined));
  }

  private addItems(submissionName: string, items: CreateItemParams[]): Observable<void> {
    if (items.length === 0) {
      return of(undefined);
    }
    return forkJoin(
      items.map((item) =>
        this.itemSvc.SubmissionItemServiceCreateSubmissionItem({
          parent: submissionName,
          item: itemToProto(item),
        }),
      ),
    ).pipe(map(() => undefined));
  }

  submitSubmission(id: string): Observable<Submission> {
    return this.submissionSvc
      .SubmissionServiceSubmitSubmission({
        name: this.submissionName(id),
        body: {},
      })
      .pipe(map(mapApiSubmission));
  }

  createAndSubmitSubmission(params: CreateSubmissionParams): Observable<Submission> {
    // The server requires the type structure and a committee at creation, so
    // the dense form always submits a complete answer set.
    const name$ = this.submissionSvc
      .SubmissionServiceCreateSubmission({
        parent: this.parent,
        submission: submissionToProto(this.parent, params),
      })
      .pipe(
        map((draft) => draft.name!),
        switchMap((draftName) =>
          this.addItems(draftName, params.items).pipe(map(() => draftName)),
        ),
      );
    return name$.pipe(
      switchMap((draftName) => this.submissionSvc.SubmissionServiceSubmitSubmission({ name: draftName, body: {} })),
      map(mapApiSubmission),
    );
  }
}
