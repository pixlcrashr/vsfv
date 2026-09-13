/* tslint:disable */

/**
 * LoginResponse reports a successful login. The browser session cookie is
 * already set on the response.
 */
export interface V1LoginResponse {

  /**
   * The OAuth2 authorization endpoint URL the client should follow to
   * complete the login and obtain tokens. Because the session cookie is
   * set, following this URL immediately redirects back with an
   * authorization code.
   */
  redirect_url?: string;
}
