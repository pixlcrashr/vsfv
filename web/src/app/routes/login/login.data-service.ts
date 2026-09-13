import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface LoginOptions {
  passwordEnabled: boolean;
  gitlabEnabled: boolean;
}

@Injectable()
export abstract class LoginDataService {
  /** Reports which login methods the server currently accepts. */
  abstract getLoginOptions(): Observable<LoginOptions>;

  /**
   * Verifies the credentials and establishes the browser session. On
   * success the returned URL is the OAuth2 authorize endpoint the client
   * continues the login with.
   */
  abstract login(email: string, password: string): Observable<string>;
}
