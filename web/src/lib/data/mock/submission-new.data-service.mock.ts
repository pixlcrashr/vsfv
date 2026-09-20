import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { faker } from '@faker-js/faker/locale/de';
import { Submission, SubmissionItem } from '../../../app/shared/models';
import { Committee } from '../../../app/shared/models';
import {
  SubmissionNewDataService,
  CreateSubmissionParams,
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
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
    },
  ];

  getCommitteeOptions(): Observable<Committee[]> {
    return of(this.committees.map((c) => ({ ...c, paymentAccounts: c.paymentAccounts.map((pa) => ({ ...pa })) }))).pipe(
      delay(200)
    );
  }

  createSubmissionDraft(params: CreateSubmissionParams): Observable<Submission> {
    return this.build(params, 'draft').pipe(delay(250));
  }

  submitSubmission(id: string): Observable<Submission> {
    return of({
      ...this.buildSubmissionMock(id),
      status: 'pending' as const,
    }).pipe(delay(250));
  }

  createAndSubmitSubmission(params: CreateSubmissionParams): Observable<Submission> {
    return this.build(params, 'pending').pipe(delay(300));
  }

  private buildSubmissionMock(id: string): Submission {
    return {
      id,
      publicId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserId: faker.string.uuid(),
      createdByUserFullName: faker.person.fullName(),
      committeeId: '',
      committeeName: '',
      direction: 'expense',
      settlement: null,
      scope: 'hoheitlich',
      status: 'draft',
      notice: null,
      personSettlement: null,
      committeeAccountSettlement: null,
      paymentRequestSettlement: null,
      completionPaidDate: null,
      completionPaymentReference: null,
      items: [],
      totalAmount: 0,
    };
  }

  private build(params: CreateSubmissionParams, status: 'draft' | 'pending'): Observable<Submission> {
    const year = new Date().getFullYear();
    this.publicIdCounter++;

    const committee = this.committees.find((c) => c.id === params.committeeId) ?? this.committees[0];
    const personSettlement = params.settlement?.kind === 'person' ? params.settlement : null;
    const caSettlement = params.settlement?.kind === 'committee_account' ? params.settlement : null;
    const prSettlement = params.settlement?.kind === 'payment_request' ? params.settlement : null;

    const items: SubmissionItem[] = params.items.map((item, index) => {
      const counter = 40 + index;
      return {
        id: faker.string.uuid(),
        publicId: `${year}/${String(this.publicIdCounter).padStart(2, '0')}/${counter}`,
        submissionId: '',
        category: item.category,
        documentForm: item.documentForm,
        source: item.source,
        description: item.description,
        amount: item.amount,
        attachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        originalReceived: false,
        originalReceivedAt: null,
        originalReceivedByUserId: null,
        originalReceivedByUserName: null,
      };
    });

    const newSubmission: Submission = {
      id: faker.string.uuid(),
      publicId: `${year}/${String(this.publicIdCounter).padStart(2, '0')}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserId: faker.string.uuid(),
      createdByUserFullName: faker.person.fullName(),
      committeeId: committee.id,
      committeeName: committee.name,
      direction: params.direction,
      settlement: params.settlement?.kind ?? null,
      scope: params.scope,
      status,
      notice: params.notice,
      personSettlement: personSettlement
        ? { payoutMethod: personSettlement.payoutMethod, bankDetails: personSettlement.bankDetails }
        : null,
      committeeAccountSettlement: caSettlement
        ? {
            paymentAccountUid: caSettlement.paymentAccountUid,
            paymentAccountLabel:
              committee.paymentAccounts.find((pa) => pa.uid === caSettlement.paymentAccountUid)?.label ?? '',
            paidDate: caSettlement.paidDate,
            paymentReference: caSettlement.paymentReference,
          }
        : null,
      paymentRequestSettlement: prSettlement
        ? {
            vendorName: prSettlement.vendorName,
            vendorIban: prSettlement.vendorIban,
            vendorBic: prSettlement.vendorBic,
            timing: prSettlement.timing,
          }
        : null,
      completionPaidDate: null,
      completionPaymentReference: null,
      items: items.map((item) => ({ ...item, submissionId: '' })),
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
    };

    newSubmission.items.forEach((item) => {
      item.submissionId = newSubmission.id;
    });

    return of(newSubmission);
  }
}
