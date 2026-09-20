/* tslint:disable */

/**
 * DocumentForm describes in which form the original document exists.
 */
type V1DocumentForm =
  'DOCUMENT_FORM_UNSPECIFIED' |
  'DOCUMENT_FORM_PAPER_ORIGINAL' |
  'DOCUMENT_FORM_DIGITAL_ORIGINAL';
module V1DocumentForm {
  export const DOCUMENT_FORM_UNSPECIFIED: V1DocumentForm = 'DOCUMENT_FORM_UNSPECIFIED';
  export const DOCUMENT_FORM_PAPER_ORIGINAL: V1DocumentForm = 'DOCUMENT_FORM_PAPER_ORIGINAL';
  export const DOCUMENT_FORM_DIGITAL_ORIGINAL: V1DocumentForm = 'DOCUMENT_FORM_DIGITAL_ORIGINAL';
  export function values(): V1DocumentForm[] {
    return [
      DOCUMENT_FORM_UNSPECIFIED,
      DOCUMENT_FORM_PAPER_ORIGINAL,
      DOCUMENT_FORM_DIGITAL_ORIGINAL
    ];
  }
}

export { V1DocumentForm }