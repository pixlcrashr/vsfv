export type Belegform = 'paper_original' | 'digital_original';

export type ReceiptCategory =
  | 'rechnung'
  | 'quittung_kassenbon'
  | 'eigenbeleg'
  | 'fahrtkostennachweis'
  | 'sonstige'
  | 'lieferschein'
  | 'bestellbestaetigung';

export type ReimbursementScope = 'hoheitlich' | 'gewerblich';

export type StepId =
  | 'intro'
  | 'scope'
  | 'committee'
  | 'payment'
  | 'bankDetails'
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
    case 'rechnung':
      return $localize`Rechnung`;
    case 'quittung_kassenbon':
      return $localize`Quittung / Kassenbon`;
    case 'eigenbeleg':
      return $localize`Eigenbeleg`;
    case 'fahrtkostennachweis':
      return $localize`Fahrtkostennachweis`;
    case 'sonstige':
      return $localize`Sonstige`;
    case 'lieferschein':
      return $localize`Lieferschein`;
    case 'bestellbestaetigung':
      return $localize`Bestellbestätigung`;
    default:
      return null;
  }
}

export function getDocumentFormLabel(form: Belegform): string {
  return form === 'paper_original'
    ? $localize`Papierbeleg (Original)`
    : $localize`Originär digital (E-Rechnung, PDF, usw.)`;
}
