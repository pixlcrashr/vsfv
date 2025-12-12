import { parse } from "csv-parse/browser/esm";
import Decimal from "decimal.js";
import { Transaction } from "../transaction";

export async function parseDatevTransactions(d: Blob): Promise<Transaction[]> {
  // DATEV exports are usually UTF-8 encoded
  const t = new TextDecoder('utf-8').decode(await d.arrayBuffer());

  // Split lines and skip metadata/header lines
  const lines = t.split(/\r?\n/).filter(line => line.trim().length > 0);
  // Find the header line (the one containing 'Umsatz (ohne Soll/Haben-Kz)' and 'Soll/Haben-Kennzeichen')
  const headerIdx = lines.findIndex(line => line.includes('Umsatz (ohne Soll/Haben-Kz)') && line.includes('Soll/Haben-Kennzeichen'));
  if (headerIdx === -1) throw new Error('DATEV header not found');
  const header = lines[headerIdx].split(';').map(h => h.replace(/^"|"$/g, ''));
  const dataLines = lines.slice(headerIdx + 1);

  // Parse CSV data using the detected header
  const records: Record<string, string>[] = dataLines.map(line => {
    const cols = line.split(';');
    const rec: Record<string, string> = {};
    for (let i = 0; i < header.length; ++i) {
      rec[header[i]] = (cols[i] || '').replace(/^"|"$/g, '');
    }
    return rec;
  }).filter(r => r['Umsatz (ohne Soll/Haben-Kz)'] && r['Konto'] && r['Gegenkonto (ohne BU-Schlüssel)']);

  // Map CSV fields to our transaction structure
  const ts: Transaction[] = records.map((record) => {
    function parseDate(val?: string): Date {
      if (!val || val.length < 8) return new Date();
      const y = val.slice(0, 4);
      const m = val.slice(4, 6);
      const d = val.slice(6, 8);
      return new Date(`${y}-${m}-${d}`);
    }
    return {
      bookedAt: parseDate(record['Buchungsdatum']),
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
