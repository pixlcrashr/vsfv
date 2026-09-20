// Submission (Belegeinreichung) types.
//
// A submission documents either an expense (with one of three settlement
// kinds) or an income (documentation only, no settlement).

export type SubmissionDirection = 'expense' | 'income';

// SettlementKind describes how an expense is settled:
// - person: submitter paid privately and receives a payout
// - committee_account: already paid from a committee-held account (bank or cash box)
// - payment_request: treasury pays the vendor from the central account
export type SettlementKind = 'person' | 'committee_account' | 'payment_request';

export type SubmissionScope = 'hoheitlich' | 'gewerblich';

export type SubmissionStatus =
  | 'draft'
  | 'pending'
  | 'further_info_required'
  | 'rejected'
  | 'approved'
  | 'completed';

export type PayoutMethod = 'bank_transfer' | 'cash';

export type PaymentRequestTiming = 'on_invoice' | 'advance';

export type DocumentForm = 'paper_original' | 'digital_original';

export type CommitteePaymentAccountKind = 'bank_account' | 'cash_box';

export interface BankDetails {
  accountHolder: string;
  iban: string;
  bic: string | null;
}

export interface PersonSettlement {
  payoutMethod: PayoutMethod;
  bankDetails: BankDetails | null;
}

export interface CommitteeAccountSettlement {
  paymentAccountUid: string;
  paymentAccountLabel: string;
  paidDate: Date | null;
  paymentReference: string | null;
}

export interface PaymentRequestSettlement {
  vendorName: string;
  vendorIban: string;
  vendorBic: string | null;
  timing: PaymentRequestTiming;
}

export interface CommitteePaymentAccount {
  uid: string;
  kind: CommitteePaymentAccountKind;
  label: string;
}

export interface Attachment {
  id: string;
  submissionItemId: string;
  fileName: string;
  mimeType: string;
  fileSize: number; // bytes
  storageKey: string;
  uploadedAt: Date;
}

export interface SubmissionItem {
  id: string;
  publicId: string;
  submissionId: string;
  category: string;
  documentForm: DocumentForm;
  source: string | null; // income origin (sponsor, donor, ...)
  description: string | null;
  amount: number; // in cents
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
  // Original document tracking (treasury side)
  originalReceived: boolean;
  originalReceivedAt: Date | null;
  originalReceivedByUserId: string | null;
  originalReceivedByUserName: string | null;
}

export interface Submission {
  id: string;
  publicId: string; // Format: "YYYY/NN"
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
  createdByUserFullName: string;
  committeeId: string;
  committeeName: string;
  direction: SubmissionDirection;
  settlement: SettlementKind | null; // null for income submissions
  scope: SubmissionScope;
  status: SubmissionStatus;
  notice: string | null;
  personSettlement: PersonSettlement | null;
  committeeAccountSettlement: CommitteeAccountSettlement | null;
  paymentRequestSettlement: PaymentRequestSettlement | null;
  completionPaidDate: Date | null;
  completionPaymentReference: string | null;
  items: SubmissionItem[];
  totalAmount: number; // calculated sum of items in cents
}

export interface SubmissionComment {
  id: string;
  submissionId: string;
  authorUserId: string;
  authorUserFullName: string;
  content: string;
  isAdminOnly: boolean;
  statusChange: {
    from: SubmissionStatus;
    to: SubmissionStatus;
  } | null;
  createdAt: Date;
}

export interface SubmissionAuditEntry {
  id: string;
  submissionId: string;
  actorUserId: string;
  actorUserFullName: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  timestamp: Date;
}

// Helper functions for status display
export function getSubmissionStatusLabel(status: SubmissionStatus): string {
  const labels: Record<SubmissionStatus, string> = {
    draft: $localize`Entwurf`,
    pending: $localize`Ausstehend`,
    further_info_required: $localize`Weitere Informationen erforderlich`,
    rejected: $localize`Abgelehnt`,
    approved: $localize`Freigegeben`,
    completed: $localize`Abgeschlossen`,
  };
  return labels[status];
}

export function getSubmissionStatusVariant(
  status: SubmissionStatus
): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  const variants: Record<SubmissionStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
    draft: 'neutral',
    pending: 'info',
    further_info_required: 'warning',
    rejected: 'danger',
    approved: 'success',
    completed: 'success',
  };
  return variants[status];
}

// SettlementPayload: the settlement variant as submitted from the UI forms.
export type SettlementPayload =
  | { kind: 'person'; payoutMethod: PayoutMethod; bankDetails: BankDetails | null }
  | {
      kind: 'committee_account';
      paymentAccountUid: string;
      paidDate: Date | null;
      paymentReference: string | null;
    }
  | {
      kind: 'payment_request';
      vendorName: string;
      vendorIban: string;
      vendorBic: string | null;
      timing: PaymentRequestTiming;
    };

export function getDirectionLabel(direction: SubmissionDirection): string {
  return direction === 'income' ? $localize`Einnahme` : $localize`Ausgabe`;
}

export function getSettlementLabel(settlement: SettlementKind): string {
  const labels: Record<SettlementKind, string> = {
    person: $localize`Auslagenerstattung (privat vorgestreckt)`,
    committee_account: $localize`Aus Gremiumskonto/-kasse bezahlt`,
    payment_request: $localize`Zahlungsauftrag an die Kassenführung`,
  };
  return labels[settlement];
}

export function getScopeLabel(scope: SubmissionScope): string {
  return scope === 'gewerblich' ? $localize`Gewerblich` : $localize`Hoheitlich`;
}

export function getPaymentRequestTimingLabel(timing: PaymentRequestTiming): string {
  return timing === 'advance' ? $localize`Vorkasse` : $localize`Zahlung auf Rechnung`;
}

export function getCommitteePaymentAccountKindLabel(kind: CommitteePaymentAccountKind): string {
  return kind === 'cash_box' ? $localize`Kasse` : $localize`Bankkonto`;
}

// formatCurrency is exported from application.model.ts
