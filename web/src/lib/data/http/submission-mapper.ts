// Mappers from generated V1* DTOs (snake_case, enum strings) to the app
// submission models.

import { V1Submission } from '../../api/models/v1submission';
import { V1SubmissionItem } from '../../api/models/v1submission-item';
import { V1SubmissionComment } from '../../api/models/v1submission-comment';
import { V1Committee } from '../../api/models/v1committee';
import {
  Submission,
  SubmissionComment,
  SubmissionDirection,
  SettlementKind,
  SubmissionScope,
  SubmissionStatus,
  PayoutMethod,
  PaymentRequestTiming,
  DocumentForm,
  CommitteePaymentAccountKind,
  SubmissionItem,
  Committee,
} from '../../../app/shared/models';

// 'DIRECTION_EXPENSE' → 'expense', 'SUBMISSION_STATUS_DRAFT' → 'draft', ...
// Converts a decimal string (e.g. "12.34") into integer cents.
export function decimalStringToCents(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function stripEnumPrefix(value: string | undefined): string {
  if (!value) return '';
  const idx = value.indexOf('_');
  return idx >= 0 ? value.slice(idx + 1).toLowerCase() : value.toLowerCase();
}

export function mapApiDirection(value: string | undefined): SubmissionDirection {
  return (stripEnumPrefix(value) || 'expense') as SubmissionDirection;
}

export function mapApiSettlement(value: string | undefined): SettlementKind | null {
  const v = stripEnumPrefix(value);
  return v ? (v as SettlementKind) : null;
}

export function mapApiScope(value: string | undefined): SubmissionScope {
  return (stripEnumPrefix(value) || 'hoheitlich') as SubmissionScope;
}

export function mapApiStatus(value: string | undefined): SubmissionStatus {
  return (stripEnumPrefix(value) || 'draft') as SubmissionStatus;
}

export function mapApiPayoutMethod(value: string | undefined): PayoutMethod {
  return (stripEnumPrefix(value) || 'bank_transfer') as PayoutMethod;
}

export function mapApiTiming(value: string | undefined): PaymentRequestTiming {
  return (stripEnumPrefix(value) || 'on_invoice') as PaymentRequestTiming;
}

export function mapApiDocumentForm(value: string | undefined): DocumentForm {
  return (stripEnumPrefix(value) || 'paper_original') as DocumentForm;
}

export function mapApiPaymentAccountKind(value: string | undefined): CommitteePaymentAccountKind {
  return (stripEnumPrefix(value) || 'bank_account') as CommitteePaymentAccountKind;
}

export function uidFromResourceName(name: string | undefined): string {
  return name?.split('/').pop() ?? '';
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
  const direction = mapApiDirection(s.direction);
  const settlement = direction === 'income' ? null : mapApiSettlement(s.settlement);

  const person =
    s.person_details && settlement === 'person'
      ? {
          payoutMethod: mapApiPayoutMethod(s.person_details.payout_method),
          bankDetails: s.person_details.bank_details
            ? {
                accountHolder: s.person_details.bank_details.account_holder ?? '',
                iban: s.person_details.bank_details.iban ?? '',
                bic: s.person_details.bank_details.bic || null,
              }
            : null,
        }
      : null;

  const committeeAccount =
    s.committee_account_details && settlement === 'committee_account'
      ? {
          paymentAccountUid: s.committee_account_details.payment_account_uid ?? '',
          paymentAccountLabel: s.committee_account_details.payment_account_label ?? '',
          paidDate: s.committee_account_details.paid_date
            ? new Date(
                s.committee_account_details.paid_date.year ?? 1970,
                (s.committee_account_details.paid_date.month ?? 1) - 1,
                s.committee_account_details.paid_date.day ?? 1
              )
            : null,
          paymentReference: s.committee_account_details.payment_reference || null,
        }
      : null;

  const paymentRequest =
    s.payment_request_details && settlement === 'payment_request'
      ? {
          vendorName: s.payment_request_details.vendor_name ?? '',
          vendorIban: s.payment_request_details.vendor_iban ?? '',
          vendorBic: s.payment_request_details.vendor_bic || null,
          timing: mapApiTiming(s.payment_request_details.timing),
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
    direction,
    settlement,
    scope: mapApiScope(s.scope),
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

export function mapApiCommittee(c: V1Committee): Committee {
  const paymentAccounts = (c.payment_accounts ?? []).map((pa) => ({
    uid: pa.uid ?? '',
    kind: mapApiPaymentAccountKind(pa.kind) as CommitteePaymentAccountKind,
    label: pa.display_label ?? '',
  }));
  return {
    id: c.uid ?? uidFromResourceName(c.name),
    name: c.display_name ?? '',
    description: c.display_description || null,
    isActive: true,
    allowScopeSelection: !!c.allow_scope_selection,
    paymentAccounts,
    createdAt: c.create_time ? new Date(c.create_time) : new Date(),
    updatedAt: c.update_time ? new Date(c.update_time) : new Date(),
  };
}
