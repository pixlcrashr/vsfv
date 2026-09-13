/* tslint:disable */

/**
 * LoginOptions describes which login methods the server currently accepts.
 * The login page uses this to decide which login options to display.
 */
export interface V1LoginOptions {

  /**
   * Whether GitLab SSO login is enabled.
   */
  gitlab_enabled?: boolean;

  /**
   * Whether password-based login is enabled.
   */
  password_enabled?: boolean;
}
