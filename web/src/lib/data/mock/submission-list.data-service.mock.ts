import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { faker } from '@faker-js/faker/locale/de';
import {
  Submission,
  SubmissionStatus,
  SubmissionDirection,
  SettlementKind,
  SubmissionItem,
} from '../../../app/shared/models';
import { Committee } from '../../../app/shared/models';
import { SubmissionListDataService } from '../../../app/routes/submissions/submission-list/submission-list.data-service';

const SETTLEMENTS: SettlementKind[] = ['person', 'committee_account', 'payment_request'];
const DIRECTIONS: SubmissionDirection[] = ['expense', 'expense', 'expense', 'income'];

@Injectable()
export class MockSubmissionListDataService extends SubmissionListDataService {
  private submissions: Submission[] = this.generateSubmissions();
  private committees: Committee[] = this.generateCommittees();

  getSubmissions(filters?: {
    status?: SubmissionStatus;
    committeeId?: string;
    direction?: SubmissionDirection;
    includeOwnDrafts?: boolean;
  }): Observable<Submission[]> {
    let result = [...this.submissions];

    if (filters?.status) {
      result = result.filter((r) => r.status === filters.status);
    }
    if (filters?.committeeId) {
      result = result.filter((r) => r.committeeId === filters.committeeId);
    }
    if (filters?.direction) {
      result = result.filter((r) => r.direction === filters.direction);
    }

    return of(result).pipe(delay(300));
  }

  getCommittees(): Observable<Committee[]> {
    return of([...this.committees]).pipe(delay(200));
  }

  deleteSubmission(id: string): Observable<void> {
    this.submissions = this.submissions.filter((r) => r.id !== id);
    return of(undefined).pipe(delay(300));
  }

  private generateSubmissions(): Submission[] {
    const submissions: Submission[] = [];
    const statuses: SubmissionStatus[] = [
      'pending',
      'further_info_required',
      'rejected',
      'completed',
      'approved',
      'draft',
    ];
    const year = new Date().getFullYear();

    for (let i = 1; i <= 8; i++) {
      const status = statuses[i % statuses.length];
      const direction = DIRECTIONS[i % DIRECTIONS.length];
      const settlement: SettlementKind | null =
        direction === 'income' ? null : SETTLEMENTS[i % SETTLEMENTS.length];

      const items: SubmissionItem[] = Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, (_, j) => {
        const category =
          direction === 'income'
            ? faker.helpers.arrayElement(['Spendenquittung', 'Sponsoringvertrag', 'Zustellungsbestätigung'])
            : faker.helpers.arrayElement(['rechnung', 'quittung_kassenbon', 'eigenbeleg', 'fahrtkostennachweis']);

        return {
          id: faker.string.uuid(),
          publicId: `${year}/${String(i).padStart(2, '0')}/${j + 1}`,
          submissionId: '',
          category,
          documentForm: (faker.helpers.arrayElement(['paper_original', 'digital_original']) as SubmissionItem['documentForm']),
          source: direction === 'income' ? faker.company.name() : null,
          description: faker.datatype.boolean() ? faker.commerce.productName() : null,
          amount: faker.number.int({ min: 500, max: 20000 }),
          attachments: faker.datatype.boolean()
            ? [
                {
                  id: faker.string.uuid(),
                  submissionItemId: '',
                  fileName: `beleg_${i}_${j}.pdf`,
                  mimeType: 'application/pdf',
                  fileSize: faker.number.int({ min: 10000, max: 500000 }),
                  storageKey: faker.string.uuid(),
                  uploadedAt: faker.date.recent(),
                },
              ]
            : [],
          createdAt: faker.date.recent(),
          updatedAt: faker.date.recent(),
          originalReceived: status === 'completed' && faker.datatype.boolean(),
          originalReceivedAt: null,
          originalReceivedByUserId: null,
          originalReceivedByUserName: null,
        };
      });

      const submissionId = faker.string.uuid();
      items.forEach((item) => {
        item.submissionId = submissionId;
        item.attachments.forEach((att) => {
          att.submissionItemId = item.id;
        });
      });

      submissions.push({
        id: submissionId,
        publicId: `${year}/${String(i).padStart(2, '0')}`,
        createdAt: faker.date.recent({ days: 60 }),
        updatedAt: faker.date.recent({ days: 30 }),
        createdByUserId: faker.string.uuid(),
        createdByUserFullName: faker.person.fullName(),
        committeeId: 'committee-asta',
        committeeName: 'AStA',
        direction,
        settlement,
        scope: i % 4 === 0 ? 'gewerblich' : 'hoheitlich',
        status,
        notice: faker.datatype.boolean() ? faker.lorem.sentence() : null,
        personSettlement:
          settlement === 'person'
            ? {
                payoutMethod: i % 2 === 0 ? 'bank_transfer' : 'cash',
                bankDetails:
                  i % 2 === 0
                    ? {
                        accountHolder: faker.person.fullName(),
                        iban: faker.finance.iban({ countryCode: 'DE' }),
                        bic: faker.finance.bic(),
                      }
                    : null,
              }
            : null,
        committeeAccountSettlement:
          settlement === 'committee_account'
            ? {
                paymentAccountUid: 'acc-asta-bank',
                paymentAccountLabel: 'Gremiumskonto AStA',
                paidDate: faker.date.recent(),
                paymentReference: null,
              }
            : null,
        paymentRequestSettlement:
          settlement === 'payment_request'
            ? {
                vendorName: faker.company.name(),
                vendorIban: faker.finance.iban({ countryCode: 'DE' }),
                vendorBic: faker.finance.bic(),
                timing: i % 2 === 0 ? 'on_invoice' : 'advance',
              }
            : null,
        completionPaidDate: status === 'completed' ? faker.date.recent() : null,
        completionPaymentReference: null,
        items,
        totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
      });
    }

    return submissions;
  }

  private generateCommittees(): Committee[] {
    return [
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
    ];
  }
}
