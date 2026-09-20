import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CommitteeServiceService } from '../../api/services/committee-service.service';
import { SubmissionServiceService } from '../../api/services/submission-service.service';
import { V1Submission } from '../../api/models/v1submission';
  import { V1PersonDetails } from '../../api/models/v1person-details';
  import { V1CommitteeAccountDetails } from '../../api/models/v1committee-account-details';
  import { V1PaymentRequestDetails } from '../../api/models/v1payment-request-details';
import { CurrentOrganizationService } from '../../../app/shared/services/current-organization.service';
import { Committee, Submission } from '../../../app/shared/models';
import { mapApiCommittee, mapApiSubmission } from './submission-mapper';
import {
  SubmissionNewDataService,
  CreateSubmissionParams,
} from '../../../app/routes/submissions/submission-new/submission-new.data-service';

// Maps the UI settlement payload onto the proto oneof message fields.
function settlementToProto(
  params: CreateSubmissionParams
): Record<string, unknown> | undefined {
  const settlement = params.settlement;
  if (params.direction === 'income' || !settlement) {
    return undefined;
  }
  switch (settlement.kind) {
    case 'person':
      return {
        payout_method: `PAYOUT_METHOD_${settlement.payoutMethod.toUpperCase()}`,
        bank_details: settlement.bankDetails
          ? {
              account_holder: settlement.bankDetails.accountHolder,
              iban: settlement.bankDetails.iban,
              bic: settlement.bankDetails.bic ?? '',
            }
          : undefined,
      };
    case 'committee_account':
      return {
        payment_account_uid: settlement.paymentAccountUid,
        paid_date: settlement.paidDate
          ? {
              year: settlement.paidDate.getFullYear(),
              month: settlement.paidDate.getMonth() + 1,
              day: settlement.paidDate.getDate(),
            }
          : undefined,
        payment_reference: settlement.paymentReference ?? '',
      };
    case 'payment_request':
      return {
        vendor_name: settlement.vendorName,
        vendor_iban: settlement.vendorIban,
        vendor_bic: settlement.vendorBic ?? '',
        timing: `PAYMENT_REQUEST_TIMING_${settlement.timing.toUpperCase()}`,
      };
  }
}

function submissionToProto(parent: string, params: CreateSubmissionParams): V1Submission {
  const details = settlementToProto(params);
  const body: V1Submission = {
    committee: `${parent}/committees/${params.committeeId}`,
    direction: `DIRECTION_${params.direction.toUpperCase()}` as V1Submission['direction'],
    scope: `SCOPE_${params.scope === 'gewerblich' ? 'COMMERCIAL' : 'NONPROFIT'}`,
    notice: params.notice ?? '',
  };
  if (details) {
    const kind = params.settlement!.kind;
    if (kind === 'person') {
      body['person_details'] = details as never;
    } else if (kind === 'committee_account') {
      body['committee_account_details'] = details as never;
    } else {
      body['payment_request_details'] = details as never;
    }
  }
  return body;
}

@Injectable()
export class HttpSubmissionNewDataService extends SubmissionNewDataService {
  private readonly committeeSvc = inject(CommitteeServiceService);
  private readonly submissionSvc = inject(SubmissionServiceService);
  private readonly currentOrganization = inject(CurrentOrganizationService);

  private get organizationId(): string {
    return this.currentOrganization.currentOrganizationId() ?? '';
  }

  private get parent(): string {
    return `organizations/${this.organizationId}`;
  }

  getCommitteeOptions(): Observable<Committee[]> {
    return this.committeeSvc
      .CommitteeServiceListCommittees({ parent: this.parent, pageSize: 100 })
      .pipe(map((resp) => (resp.committees ?? []).map(mapApiCommittee)));
  }

  createSubmissionDraft(params: CreateSubmissionParams): Observable<Submission> {
    return this.submissionSvc
      .SubmissionServiceCreateSubmission({
        parent: this.parent,
        submission: submissionToProto(this.parent, params),
      })
      .pipe(map(mapApiSubmission));
  }

  submitSubmission(id: string): Observable<Submission> {
    return this.submissionSvc
      .SubmissionServiceSubmitSubmission({
        name: `organizations/${this.organizationId}/submissions/${id}`,
        body: {},
      })
      .pipe(map(mapApiSubmission));
  }

  createAndSubmitSubmission(params: CreateSubmissionParams): Observable<Submission> {
    return this.createSubmissionDraft(params).pipe(
      map((draft) => {
        this.submissionSvc
          .SubmissionServiceSubmitSubmission({
            name: `organizations/${this.organizationId}/submissions/${draft.id}`,
            body: {},
          })
          .subscribe();
        return { ...draft, status: 'pending' as const };
      })
    );
  }
}
