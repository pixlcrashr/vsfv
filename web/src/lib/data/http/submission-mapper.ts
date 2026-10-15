// Mappers from generated V1* DTOs (snake_case, enum strings) to the app
// submission models.

import { V1Submission } from '../../api/models/v1submission';
import { V1SubmissionItem } from '../../api/models/v1submission-item';
import { V1SubmissionComment } from '../../api/models/v1submission-comment';
import { V1Committee } from '../../api/models/v1committee';
import { V1CommitteePaymentAccount } from '../../api/models/v1committee-payment-account';
import { V1PaymentAccountKind } from '../../api/models/v1payment-account-kind';
import {
  Submission,
  SubmissionComment,
  SubmissionDirection,
  SettlementKind,
  SubmissionScope,
  SubmissionStatus,
  SubmissionType,
  PayoutMethod,
  DocumentForm,
  CommitteePaymentAccountKind,
  BankDetails,
  SubmissionItem,
  Committee,
} from '../../../app/shared/models';

// 'SUBMISSION_STATUS_DRAFT' → 'draft', 'PAYMENT_ACCOUNT_KIND_BANK_ACCOUNT' →
// 'bank_account', ... Converts a decimal string (e.g. "12.34") into integer
// cents.
export function decimalStringToCents(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

// stripEnumPrefix removes the leading enum family segments of a generated
// enum value ('SUBMISSION_STATUS_DRAFT' with 2 segments → 'draft').
export function stripEnumPrefix(value: string | undefined, segments = 1): string {
  if (!value) return '';
  let v = value;
  for (let i = 0; i < segments; i++) {
    const idx = v.indexOf('_');
    if (idx < 0) break;
    v = v.slice(idx + 1);
  }
  return v.toLowerCase();
}

export function mapApiType(submission: V1Submission): SubmissionType {
  return submission.misc ? 'misc' : 'income_expense';
}

export function mapApiDirection(value: string | undefined): SubmissionDirection {
  return (stripEnumPrefix(value) || 'expense') as SubmissionDirection;
}

export function mapApiScope(value: string | undefined): SubmissionScope {
  return (stripEnumPrefix(value, 2) || 'hoheitlich') as SubmissionScope;
}

export function mapApiStatus(value: string | undefined): SubmissionStatus {
  return (stripEnumPrefix(value, 2) || 'draft') as SubmissionStatus;
}

export function mapApiDocumentForm(value: string | undefined): DocumentForm {
  return (stripEnumPrefix(value, 2) || 'paper_original') as DocumentForm;
}

export function mapApiPaymentAccountKind(value: string | undefined): CommitteePaymentAccountKind {
  return (stripEnumPrefix(value, 3) || 'bank_account') as CommitteePaymentAccountKind;
}

export function toApiPaymentAccountKind(kind: CommitteePaymentAccountKind): V1PaymentAccountKind {
  return ('PAYMENT_ACCOUNT_KIND_' + kind.toUpperCase()) as V1PaymentAccountKind;
}

export function uidFromResourceName(name: string | undefined): string {
  return name?.split('/').pop() ?? '';
}

// Person payout method: the generated model encodes the oneof as the
// bank_transfer/cash message fields.
function payoutMethodFromPerson(person: {
  bank_transfer?: unknown;
  cash?: unknown;
}): PayoutMethod | null {
  if (person.bank_transfer) return 'bank_transfer';
  if (person.cash) return 'cash';
  return null;
}

function bankDetailsFromApi(ba: {
  account_holder?: string;
  iban?: string;
  bic?: string;
  account_number?: string;
} | null): BankDetails | null {
  if (!ba) return null;
  return {
    accountHolder: ba.account_holder ?? '',
    iban: ba.iban ?? '',
    bic: ba.bic || null,
    accountNumber: ba.account_number || null,
  };
}

export function mapApiSubmissionItem(s: V1SubmissionItem): SubmissionItem {
  return {
    id: s.uid ?? uidFromResourceName(s.name),
    publicId: s.public_id ?? '',
    submissionId: uidFromResourceName(
      s.name?.split('/items/')[0] ?? ''
    ),
    category: s.category ?? '',
    documentForm: mapApiDocumentForm(s.document_form),
    source: s.source || null,
    description: s.description || null,
    amount: decimalStringToCents(s.amount?.value),
    attachments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    originalReceived: !!s.original_receive_time,
    originalReceivedAt: s.original_receive_time ? new Date(s.original_receive_time) : null,
    originalReceivedByUserId: s.original_received_by
      ? uidFromResourceName(s.original_received_by)
      : null,
    originalReceivedByUserName: null,
  };
}

export function mapApiSubmission(s: V1Submission): Submission {
  const type = mapApiType(s);
  const incomeExpense = type === 'misc' ? null : s.income_expense;
  const direction: SubmissionDirection | null =
    type === 'misc' ? null : incomeExpense?.expense ? 'expense' : 'income';
  const settlement: SettlementKind | null =
    direction === 'expense'
      ? incomeExpense?.expense?.person
        ? 'person'
        : incomeExpense?.expense?.committee_account
          ? 'committee_account'
          : incomeExpense?.expense?.payment_request
            ? 'payment_request'
            : null
      : null;

  const person =
    direction === 'expense' && incomeExpense?.expense?.person
      ? {
          payoutMethod: payoutMethodFromPerson(incomeExpense.expense.person) ?? 'bank_transfer',
          bankDetails: bankDetailsFromApi(incomeExpense.expense.person.bank_transfer?.bank_account ?? null),
        }
      : null;

  const committeeAccount =
    direction === 'expense' && incomeExpense?.expense?.committee_account
      ? {
          paymentAccountUid: uidFromResourceName(
            incomeExpense.expense.committee_account.payment_account
          ),
          paymentAccountLabel: '',
          paidDate: incomeExpense.expense.committee_account.paid_date
            ? new Date(
                incomeExpense.expense.committee_account.paid_date.year ?? 1970,
                (incomeExpense.expense.committee_account.paid_date.month ?? 1) - 1,
                incomeExpense.expense.committee_account.paid_date.day ?? 1
              )
            : null,
          paymentReference: incomeExpense.expense.committee_account.payment_reference || null,
        }
      : null;

  const paymentRequest =
    direction === 'expense' && incomeExpense?.expense?.payment_request
      ? {
          bankDetails: bankDetailsFromApi(incomeExpense.expense.payment_request.bank_account) ?? {
            accountHolder: '',
            iban: '',
            bic: null,
            accountNumber: null,
          },
        }
      : null;

  return {
    id: s.uid ?? uidFromResourceName(s.name),
    publicId: s.public_id ?? '',
    createdAt: s.create_time ? new Date(s.create_time) : new Date(),
    updatedAt: s.update_time ? new Date(s.update_time) : new Date(),
    createdByUserId: uidFromResourceName(s.created_by_user),
    createdByUserFullName: '',
    committeeId: uidFromResourceName(s.committee),
    committeeName: '',
    type,
    direction,
    settlement,
    scope: incomeExpense ? mapApiScope(incomeExpense.scope) : null,
    status: mapApiStatus(s.status),
    notice: s.notice || null,
    personSettlement: person,
    committeeAccountSettlement: committeeAccount,
    paymentRequestSettlement: paymentRequest,
    completionPaidDate: null,
    completionPaymentReference: null,
    items: [],
    totalAmount: decimalStringToCents(s.total_amount?.value),
  };
}

export function mapApiSubmissionComment(c: V1SubmissionComment): SubmissionComment {
  return {
    id: c.uid ?? uidFromResourceName(c.name),
    submissionId: uidFromResourceName(c.name?.split('/comments/')[0] ?? ''),
    authorUserId: uidFromResourceName(c.created_by_user),
    authorUserFullName: '',
    content: c.content ?? '',
    isAdminOnly: !!c.is_admin_only,
    statusChange:
      c.status_change && c.status_change.from && c.status_change.to
        ? {
            from: mapApiStatus(c.status_change.from),
            to: mapApiStatus(c.status_change.to),
          }
        : null,
    createdAt: c.create_time ? new Date(c.create_time) : new Date(),
  };
}

// mapApiCommittee maps the committee message. Payment accounts are a separate
// sub-resource and are attached by the caller (see
// mapApiCommitteePaymentAccount).
export function mapApiCommittee(c: V1Committee): Committee {
  return {
    id: c.uid ?? uidFromResourceName(c.name),
    name: c.display_name ?? '',
    description: c.display_description || null,
    isActive: true,
    allowScopeSelection: !!c.allow_scope_selection,
    paymentAccounts: [],
    isReferenced: !!c.is_referenced,
    createdAt: c.create_time ? new Date(c.create_time) : new Date(),
    updatedAt: c.update_time ? new Date(c.update_time) : new Date(),
  };
}

export function mapApiCommitteePaymentAccount(pa: V1CommitteePaymentAccount): {
  uid: string;
  kind: CommitteePaymentAccountKind;
  label: string;
} {
  return {
    uid: pa.uid ?? uidFromResourceName(pa.name),
    kind: mapApiPaymentAccountKind(pa.kind),
    label: pa.display_label ?? '',
  };
}
