import { parse } from "csv-parse/browser/esm";
import Decimal from "decimal.js";
import { Transaction } from "../transaction";

export async function parseDatevTransactions(d: Blob): Promise<Transaction[]> {
  const t = new TextDecoder('windows-1252').decode(await d.arrayBuffer());
  
  const lines = t.split(/\r?\n/).filter(line => line.trim().length > 0);
  const headerIdx = lines.findIndex(line => line.includes('Umsatz (ohne Soll/Haben-Kz)') && line.includes('Soll/Haben-Kennzeichen'));
  
  if (headerIdx === -1) throw new Error('DATEV header not found');
  
  const csvData = lines.slice(headerIdx).join('\n');
  
  const records = await new Promise<Record<string, string>[]>((resolve, reject) => {
    parse(csvData, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true
    }, (err, output) => {
      if (err) {
        reject(err);
      } else {
        resolve(output as Record<string, string>[]);
      }
    });
  });
  
  const ts: Transaction[] = records.map((record) => {
    function parseDate(val?: string): Date {
      if (!val || val.length < 8) return new Date();
      const y = val.slice(0, 4);
      const m = val.slice(4, 6);
      const d = val.slice(6, 8);
      return new Date(`${y}-${m}-${d}`);
    }

    return {
      bookedAt: parseDate(record['Belegdatum']),
      receiptFrom: parseDate(record['Belegdatum']),
      ...(record['Soll/Haben-Kennzeichen'] === 'H' ? {
        debitAccount: record['Gegenkonto (ohne BU-Schlüssel)'],
        creditAccount: record['Konto'],
      } : {
        debitAccount: record['Konto'],
        creditAccount: record['Gegenkonto (ohne BU-Schlüssel)'],
      }),
      amount: new Decimal(record['Umsatz (ohne Soll/Haben-Kz)'] ? record['Umsatz (ohne Soll/Haben-Kz)'].replace('.', '').replace(',', '.') : '0'),
      receiptNumberGroup: record['Belegfeld 1'] || undefined,
      receiptNumber: record['Belegfeld 2'] || undefined,
      description: record['Buchungstext'] || '',
      taxKey: record['BU-Schlüssel'] || undefined,
      costCategory1: record['KOST1 - Kostenstelle'] || undefined,
      costCategory2: record['KOST2 - Kostenstelle'] || undefined,
      additional: record['Zusatzinformation- Inhalt 1'] || undefined,
    };
  });

  return ts;
}
