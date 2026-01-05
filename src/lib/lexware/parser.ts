import { parse } from "csv-parse/browser/esm";
import Decimal from "decimal.js";
import { parseGermanDate } from "../format";
import { Transaction } from "../transaction";

export async function parseLexwareTransactions(d: Blob): Promise<Transaction[]> {
  // Lexware buchhaltung's exports use windows-1252 encoding
  const t = new TextDecoder('windows-1252').decode(
    new Uint8Array(await d.arrayBuffer())
  );

  const records: Record<string, string>[] = await new Promise((resolve, reject) => {
    parse(
      t,
      {
        relax_quotes: true,
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: ";"
      },
      (err, output: Record<string, string>[]) => {
        if (err) reject(err);
        else resolve(output);
      }
    );
  });

  const ts: Transaction[] = records.map((record): Transaction => {
    const rawAmount = new Decimal(record['Buchungsbetrag'] ? record['Buchungsbetrag'].replaceAll('.', '').replaceAll(',', '.') : '0');
    const isNegative = rawAmount.isNeg();
    const amount = rawAmount.abs();
    const debitAccount = isNegative ? record['Habenkonto'] : record['Sollkonto'];
    const creditAccount = isNegative ? record['Sollkonto'] : record['Habenkonto'];
    
    return {
      receiptFrom: parseGermanDate(record['Belegdatum']) ?? new Date(),
      bookedAt: parseGermanDate(record['Buchungsdatum']) ?? new Date(),
      receiptNumberGroup: record['Belegnummernkreis'] || undefined,
      receiptNumber: record['Belegnummer'] || undefined,
      description: record['Buchungstext'],
      amount,
      debitAccount,
      creditAccount,
      taxKey: record['Steuerschlüssel'] || undefined,
      costCategory1: record['Kostenstelle 1'] || undefined,
      costCategory2: record['Kostenstelle 2'] || undefined,
      additional: record['Zusatzangaben'] || undefined,
    };
  });

  // split group bookings to separate transactions

  const results: Transaction[] = [];

  let i = 0;

  while (i < ts.length) {
    const t = ts[i];

    // split transaction
    if (t.creditAccount === "0" || t.debitAccount === "0") {
      if (i + 1 >= ts.length) {
        i++;
        continue;
      }

      i++;
      while (i < ts.length) {
        const nT = ts[i];

        // break if this record starts a new valid transaction pair
        if (nT.creditAccount !== "" && nT.debitAccount !== "") {
          break;
        }

        const debitAccount = nT.debitAccount || t.debitAccount;
        const creditAccount = nT.creditAccount || t.creditAccount;

        if (!t.bookedAt || !t.receiptFrom) {
          throw new Error("expected date for the parsed transaction");
        }

        results.push({
          bookedAt: t.bookedAt,
          receiptFrom: t.receiptFrom,
          description: nT.description,
          additional: nT.additional,
          debitAccount,
          creditAccount,
          costCategory1: nT.costCategory1,
          costCategory2: nT.costCategory2,
          receiptNumber: t.receiptNumber,
          receiptNumberGroup: t.receiptNumberGroup,
          amount: nT.amount,
          taxKey: nT.taxKey,
        });

        i++;
      }
      continue;
    }

    // single transaction
    if (!t.bookedAt || !t.receiptFrom) {
      throw new Error("expected date for the parsed transaction");
    }

    results.push(t);

    i++;
  }

  return results;
}
