/* tslint:disable */

/**
 * Change describes a single field-level modification within an audit log
 * entry. Values are rendered as strings; an empty value means the field was
 * absent (or null) in that state. For creations, old_value is empty for all
 * changes; for deletions, new_value is empty for all changes.
 */
export interface AuditLogEntryChange {

  /**
   * The name of the changed field (snake_case, as in the API resource).
   */
  field?: string;

  /**
   * The field value after the change (empty for deletions).
   */
  new_value?: string;

  /**
   * The field value before the change (empty for creations).
   */
  old_value?: string;
}
