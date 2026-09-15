import { HierarchicalAccount } from '../models';

const TOKEN_RE = /\d+|\D+/g;
const NUMERIC_RUN = /^\d+$/;

function compareNumericTokens(a: string, b: string): number {
  const strippedA = a.replace(/^0+/, '') || '0';
  const strippedB = b.replace(/^0+/, '') || '0';
  if (strippedA.length !== strippedB.length) {
    return strippedA.length - strippedB.length;
  }
  if (strippedA !== strippedB) {
    return strippedA < strippedB ? -1 : 1;
  }
  return a.length - b.length;
}

/**
 * Compares two strings naturally: runs of digits compare by their numeric
 * value, so "2" sorts before "10" and "2.2" before "2.10" — a plain
 * lexicographic comparison would sort "10" before "2".
 */
export function naturalCompare(a: string, b: string): number {
  const tokensA = a.match(TOKEN_RE) ?? [a];
  const tokensB = b.match(TOKEN_RE) ?? [b];
  const length = Math.min(tokensA.length, tokensB.length);

  for (let i = 0; i < length; i++) {
    const ta = tokensA[i];
    const tb = tokensB[i];
    const isNumA = NUMERIC_RUN.test(ta);
    const isNumB = NUMERIC_RUN.test(tb);

    if (isNumA && isNumB) {
      const result = compareNumericTokens(ta, tb);
      if (result !== 0) {
        return result;
      }
      continue;
    }

    if (ta !== tb) {
      const result = ta.localeCompare(tb, undefined, { sensitivity: 'base' });
      if (result !== 0) {
        return result;
      }
    }
  }

  return tokensA.length - tokensB.length;
}

/**
 * Sorts every sibling group of the given account tree naturally by account
 * code, in place, and returns the sorted roots.
 */
export function sortAccountTreeByCode(accounts: HierarchicalAccount[]): HierarchicalAccount[] {
  accounts.sort((a, b) => naturalCompare(a.code, b.code));
  for (const account of accounts) {
    sortAccountTreeByCode(account.children);
  }
  return accounts;
}
