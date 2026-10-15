/* tslint:disable */

/**
 * Scope describes whether a submission relates to nonprofit ("hoheitlich")
 * or commercial ("gewerblich") activity.
 */
type V1SubmissionScope =
  'SUBMISSION_SCOPE_UNSPECIFIED' |
  'SUBMISSION_SCOPE_NONE' |
  'SUBMISSION_SCOPE_NONPROFIT' |
  'SUBMISSION_SCOPE_COMMERCIAL';
module V1SubmissionScope {
  export const SUBMISSION_SCOPE_UNSPECIFIED: V1SubmissionScope = 'SUBMISSION_SCOPE_UNSPECIFIED';
  export const SUBMISSION_SCOPE_NONE: V1SubmissionScope = 'SUBMISSION_SCOPE_NONE';
  export const SUBMISSION_SCOPE_NONPROFIT: V1SubmissionScope = 'SUBMISSION_SCOPE_NONPROFIT';
  export const SUBMISSION_SCOPE_COMMERCIAL: V1SubmissionScope = 'SUBMISSION_SCOPE_COMMERCIAL';
  export function values(): V1SubmissionScope[] {
    return [
      SUBMISSION_SCOPE_UNSPECIFIED,
      SUBMISSION_SCOPE_NONE,
      SUBMISSION_SCOPE_NONPROFIT,
      SUBMISSION_SCOPE_COMMERCIAL
    ];
  }
}

export { V1SubmissionScope }