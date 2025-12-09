import { Decimal } from 'decimal.js/decimal';

export interface DecimalValueChange {
  old: Decimal;
  new: Decimal;
  diff: Decimal;
}

export interface SerializableDecimalValueChange {
  old: string;
  new: string;
  diff: string;
}

export function serializeDecimalValueChange(change: DecimalValueChange): SerializableDecimalValueChange {
  return {
    old: change.old.toString(),
    new: change.new.toString(),
    diff: change.diff.toString(),
  };
}

export function deserializeDecimalValueChange(change: SerializableDecimalValueChange): DecimalValueChange {
  return {
    old: new Decimal(change.old),
    new: new Decimal(change.new),
    diff: new Decimal(change.diff),
  };
}
