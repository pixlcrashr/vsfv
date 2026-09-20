/* tslint:disable */

/**
 * Direction describes whether a submission documents an expense or an income.
 */
type V1Direction =
  'DIRECTION_UNSPECIFIED' |
  'DIRECTION_EXPENSE' |
  'DIRECTION_INCOME';
module V1Direction {
  export const DIRECTION_UNSPECIFIED: V1Direction = 'DIRECTION_UNSPECIFIED';
  export const DIRECTION_EXPENSE: V1Direction = 'DIRECTION_EXPENSE';
  export const DIRECTION_INCOME: V1Direction = 'DIRECTION_INCOME';
  export function values(): V1Direction[] {
    return [
      DIRECTION_UNSPECIFIED,
      DIRECTION_EXPENSE,
      DIRECTION_INCOME
    ];
  }
}

export { V1Direction }