/* tslint:disable */

/**
 * The kind of change that was recorded.
 *
 *  - ACTION_UNSPECIFIED: The action is unspecified. Should never be used.
 *  - ACTION_CREATE: The resource was created.
 *  - ACTION_UPDATE: The resource was updated (one or more fields changed).
 *  - ACTION_DELETE: The resource was deleted.
 */
type AuditLogEntryAction =
  'ACTION_UNSPECIFIED' |
  'ACTION_CREATE' |
  'ACTION_UPDATE' |
  'ACTION_DELETE';
module AuditLogEntryAction {
  export const ACTION_UNSPECIFIED: AuditLogEntryAction = 'ACTION_UNSPECIFIED';
  export const ACTION_CREATE: AuditLogEntryAction = 'ACTION_CREATE';
  export const ACTION_UPDATE: AuditLogEntryAction = 'ACTION_UPDATE';
  export const ACTION_DELETE: AuditLogEntryAction = 'ACTION_DELETE';
  export function values(): AuditLogEntryAction[] {
    return [
      ACTION_UNSPECIFIED,
      ACTION_CREATE,
      ACTION_UPDATE,
      ACTION_DELETE
    ];
  }
}

export { AuditLogEntryAction }