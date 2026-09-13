export interface Transaction {
  id: string;
  documentDate: Date;
  bookedAt: Date;
  updatedAt: Date;
  amount: string;
  debitLedgerAccountId: string;
  debitAccountCode: string;
  debitAccountName: string;
  creditLedgerAccountId: string;
  creditAccountCode: string;
  creditAccountName: string;
  description: string;
  assignedAccountId: string | null;
  isLedgerClosed: boolean;
  accountAssignments: TransactionAssignment[];
}

export interface TransactionAssignment {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  value: string;
}
