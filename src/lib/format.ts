import { Decimal } from "decimal.js";

export function formatUuid(id: string, format?: 'short' | 'separatorless'): string {
  switch (format) {
    case 'short':
      return id.slice(0, 8);

    case 'separatorless':
      return id.replace(/-/g, '');

    default:
      return id;
  }
}

export function formatDateShort(d: Date): string {
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

export function formatDateInputField(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function formatCurrency(d: string): string {
  const currencyFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

  return currencyFormatter.format(new Decimal(d).toNumber());
}

export function parseGermanDate(input: string): Date | null {
  if (!input) {
    return null;
  }

  // Match: DD.MM.YYYY
  const match = input.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
  );
  if (!match) {
    return null;
  }
  
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm) - 1;
  const year = Number(yyyy);

  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}
