/* tslint:disable */

/**
 * Scope describes whether a submission relates to nonprofit ("hoheitlich")
 * or commercial ("gewerblich") activity.
 */
type V1Scope =
  'SCOPE_UNSPECIFIED' |
  'SCOPE_NONPROFIT' |
  'SCOPE_COMMERCIAL';
module V1Scope {
  export const SCOPE_UNSPECIFIED: V1Scope = 'SCOPE_UNSPECIFIED';
  export const SCOPE_NONPROFIT: V1Scope = 'SCOPE_NONPROFIT';
  export const SCOPE_COMMERCIAL: V1Scope = 'SCOPE_COMMERCIAL';
  export function values(): V1Scope[] {
    return [
      SCOPE_UNSPECIFIED,
      SCOPE_NONPROFIT,
      SCOPE_COMMERCIAL
    ];
  }
}

export { V1Scope }