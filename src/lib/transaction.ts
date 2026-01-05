import { Decimal } from "decimal.js";

export interface Transaction {
  receiptFrom: Date;
  bookedAt: Date;
  receiptNumberGroup?: string;
  receiptNumber?: string;
  description: string;
  amount: Decimal;
  debitAccount: string;
  creditAccount: string;
  taxKey?: string;
  costCategory1?: string;
  costCategory2?: string;
  additional?: string;
}
