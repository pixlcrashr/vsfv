export type Belegform = 'paper_original' | 'digital_original';

export type ReceiptDirection = 'expense' | 'income';

// What the submission contains, asked before the expense/income separation:
// - single_receipt: one receipt about a single expense or income (direction applies)
// - statement: a summarized statement with multiple mixed positions
//   (cash book, event settlement, ...; documentation only)
// - other: anything else, documentation only
export type SubmissionKind = 'single_receipt' | 'statement' | 'other';

export type ReceiptCategory =
  | 'invoice'
  | 'cash_receipt'
  | 'self_written_receipt'
  | 'travel_expense_proof'
  | 'other'
  | 'delivery_note'
  | 'order_confirmation'
  | 'receipt'
  | 'cash_report'
  | 'auxiliary_receipt'
  | 'statement';

// Selectable bill types per direction: expense receipts document purchases,
// income receipts document money flowing into the Studierendenschaft.
export const DIRECTION_RECEIPT_CATEGORIES: Record<ReceiptDirection, ReceiptCategory[]> = {
  expense: [
    'invoice',
    'cash_receipt',
    'self_written_receipt',
    'travel_expense_proof',
    'other',
    'delivery_note',
    'order_confirmation',
  ],
  income: ['receipt', 'cash_report', 'invoice', 'auxiliary_receipt', 'other'],
};

// Categories that constitute a sufficient proof on their own. Weak expense
// documents (delivery note, order confirmation) only complement an invoice.
export const SUBMITTABLE_RECEIPT_CATEGORIES: Record<ReceiptDirection, ReceiptCategory[]> = {
  expense: ['invoice', 'cash_receipt', 'self_written_receipt', 'travel_expense_proof', 'other'],
  income: ['receipt', 'cash_report', 'invoice', 'auxiliary_receipt', 'other'],
};

// Categories selectable for a submission of the given kind. For "statement"
// and "other" the kind itself is the (single) item category.
export function selectableReceiptCategories(
  kind: SubmissionKind,
  direction: ReceiptDirection
): ReceiptCategory[] {
  return kind === 'single_receipt' ? DIRECTION_RECEIPT_CATEGORIES[direction] : [kind];
}

// Categories that satisfy the "at least one submittable bill" requirement.
export function submittableReceiptCategories(
  kind: SubmissionKind,
  direction: ReceiptDirection
): ReceiptCategory[] {
  if (kind === 'single_receipt') return SUBMITTABLE_RECEIPT_CATEGORIES[direction];
  return [kind];
}

export type SubmissionScope = 'hoheitlich' | 'gewerblich';

export type StepId =
  | 'intro'
  | 'committee'
  | 'kind'
  | 'direction'
  | 'scope'
  | 'settlement'
  | 'payment'
  | 'bankDetails'
  | 'accountPaid'
  | 'vendorDetails'
  | 'receiptCategory'
  | 'receiptForm'
  | 'receiptAmount'
  | 'receiptExtras'
  | 'receiptMore'
  | 'notice'
  | 'declarations'
  | 'review';

export interface WizardStep {
  id: StepId;
  receiptIndex?: number;
}

export interface InvoiceItemForm {
  documentForm: Belegform;
  receiptCategory: ReceiptCategory | '';
  description: string;
  amount: number;
  attachment: File | null;
  /** Server-side submission item id of the receipt ('' = draft item not persisted yet). */
  uid: string;
  /** Server-side attachment id of the uploaded file ('' = nothing uploaded). */
  attachmentId: string;
  /** The File object `attachmentId` was uploaded from (for change detection). */
  uploadedFile: File | null;
}

export interface ReceiptSnapshot {
  receiptCategory: ReceiptCategory | '';
  documentForm: Belegform;
  description: string;
  amountCents: number;
  attachmentName: string | null;
}

export interface BankDetailsSnapshot {
  accountHolder: string;
  iban: string;
  bic: string;
}

export function getReceiptCategoryLabel(category: ReceiptCategory | ''): string | null {
  switch (category) {
    case 'invoice':
      return $localize`Rechnung`;
    case 'cash_receipt':
      return $localize`Quittung / Kassenbon`;
    case 'self_written_receipt':
      return $localize`Eigenbeleg`;
    case 'travel_expense_proof':
      return $localize`Fahrtkostennachweis`;
    case 'other':
      return $localize`Sonstiges`;
    case 'delivery_note':
      return $localize`Lieferschein`;
    case 'order_confirmation':
      return $localize`Bestellbestätigung`;
    case 'receipt':
      return $localize`Quittung`;
    case 'cash_report':
      return $localize`Kassenbericht`;
    case 'auxiliary_receipt':
      return $localize`Eigen-/Hilfsbeleg`;
    case 'statement':
      return $localize`Abrechnung`;
    default:
      return null;
  }
}

export function getDocumentFormLabel(form: Belegform): string {
  return form === 'paper_original'
    ? $localize`Papierbeleg (Original)`
    : $localize`Originär digital (E-Rechnung, PDF, usw.)`;
}
