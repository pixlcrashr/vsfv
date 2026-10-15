/* tslint:disable */

/**
 * DocumentForm describes in which form the original document exists.
 *
 *  - DOCUMENT_FORM_UNSPECIFIED: Filler value for protobuf only; never stored in the database.
 *  - DOCUMENT_FORM_NONE: Explicitly no document form chosen yet (drafts).
 */
type V1DocumentForm =
  'DOCUMENT_FORM_UNSPECIFIED' |
  'DOCUMENT_FORM_PAPER_ORIGINAL' |
  'DOCUMENT_FORM_DIGITAL_ORIGINAL' |
  'DOCUMENT_FORM_NONE';
module V1DocumentForm {
  export const DOCUMENT_FORM_UNSPECIFIED: V1DocumentForm = 'DOCUMENT_FORM_UNSPECIFIED';
  export const DOCUMENT_FORM_PAPER_ORIGINAL: V1DocumentForm = 'DOCUMENT_FORM_PAPER_ORIGINAL';
  export const DOCUMENT_FORM_DIGITAL_ORIGINAL: V1DocumentForm = 'DOCUMENT_FORM_DIGITAL_ORIGINAL';
  export const DOCUMENT_FORM_NONE: V1DocumentForm = 'DOCUMENT_FORM_NONE';
  export function values(): V1DocumentForm[] {
    return [
      DOCUMENT_FORM_UNSPECIFIED,
      DOCUMENT_FORM_PAPER_ORIGINAL,
      DOCUMENT_FORM_DIGITAL_ORIGINAL,
      DOCUMENT_FORM_NONE
    ];
  }
}

export { V1DocumentForm }