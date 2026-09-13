/* tslint:disable */

/**
 * LoginRequest authenticates an existing user with email and password.
 * There is no registration: accounts are provisioned by the administrator
 * (adduser CLI) or through the SSO flow.
 */
export interface V1LoginRequest {

  /**
   * The e-mail address of the user.
   */
  email: string;

  /**
   * The user's password.
   */
  password: string;
}
