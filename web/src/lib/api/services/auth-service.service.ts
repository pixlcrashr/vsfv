/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1LoginResponse } from '../models/v1login-response';
import { V1LoginRequest } from '../models/v1login-request';
import { V1LoginOptions } from '../models/v1login-options';

/**
 * AuthService provides password-based login for existing users. It is
 * served by the HTTP gateway only and its endpoints are public: they do not
 * require a bearer token.
 */
@Injectable({
  providedIn: 'root',
})
class AuthServiceService extends __BaseService {
  static readonly AuthServiceLoginPath = '/v1/auth:login';
  static readonly AuthServiceGetLoginOptionsPath = '/v1/auth:loginOptions';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Verifies the credentials, creates a browser session and returns the
   * OAuth2 URL to continue the login with (custom method, AIP-136).
   * Fails with FAILED_PRECONDITION when password login is disabled and
   * UNAUTHENTICATED for unknown users or wrong passwords.
   * @param body LoginRequest authenticates an existing user with email and password.
   * There is no registration: accounts are provisioned by the administrator
   * (adduser CLI) or through the SSO flow.
   * @return A successful response.
   */
  AuthServiceLoginResponse(body: V1LoginRequest): __Observable<__StrictHttpResponse<V1LoginResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    __body = body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/auth:login`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1LoginResponse>;
      })
    );
  }
  /**
   * Verifies the credentials, creates a browser session and returns the
   * OAuth2 URL to continue the login with (custom method, AIP-136).
   * Fails with FAILED_PRECONDITION when password login is disabled and
   * UNAUTHENTICATED for unknown users or wrong passwords.
   * @param body LoginRequest authenticates an existing user with email and password.
   * There is no registration: accounts are provisioned by the administrator
   * (adduser CLI) or through the SSO flow.
   * @return A successful response.
   */
  AuthServiceLogin(body: V1LoginRequest): __Observable<V1LoginResponse> {
    return this.AuthServiceLoginResponse(body).pipe(
      __map(_r => _r.body as V1LoginResponse)
    );
  }

  /**
   * Reports which login methods are enabled (custom method, AIP-136).
   * @return A successful response.
   */
  AuthServiceGetLoginOptionsResponse(): __Observable<__StrictHttpResponse<V1LoginOptions>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/auth:loginOptions`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1LoginOptions>;
      })
    );
  }
  /**
   * Reports which login methods are enabled (custom method, AIP-136).
   * @return A successful response.
   */
  AuthServiceGetLoginOptions(): __Observable<V1LoginOptions> {
    return this.AuthServiceGetLoginOptionsResponse().pipe(
      __map(_r => _r.body as V1LoginOptions)
    );
  }
}

module AuthServiceService {
}

export { AuthServiceService }
