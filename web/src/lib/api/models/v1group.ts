/* tslint:disable */

/**
 * Group is a named collection of users that share a common set of permissions.
 * Permissions are self-standing (not scoped per organization); instead,
 * groups are assigned to organizations via the organizations field.
 */
export interface V1Group {

  /**
   * Creation timestamp.
   */
  create_time?: string;

  /**
   * Optional free-text description.
   */
  display_description?: string;

  /**
   * Human-readable group name.
   */
  display_name: string;

  /**
   * Entity tag for optimistic concurrency control.
   */
  etag?: string;

  /**
   * Whether this is a system group. System groups are managed by the
   * application and cannot be modified or deleted.
   */
  is_system?: boolean;
  name?: string;
  organizations?: Array<string>;

  /**
   * Self-standing permissions granted to this group.
   * Format: "resource:action" (e.g. "accounts:read", "users:update").
   */
  permissions?: Array<string>;

  /**
   * The UUID of the group.
   */
  uid?: string;

  /**
   * Last modification timestamp.
   */
  update_time?: string;
}
