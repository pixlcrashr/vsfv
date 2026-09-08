/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1UserSettings } from '../models/v1user-settings';

/**
 * UserSettingsService manages per-user application preferences.
 */
@Injectable({
  providedIn: 'root',
})
class UserSettingsServiceService extends __BaseService {
  static readonly UserSettingsServiceGetUserSettingsPath = '/v1/{name_19}';
  static readonly UserSettingsServiceUpdateUserSettingsPath = '/v1/{settings.name}';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Gets the settings for a user.
   * Authorization:
   *   Scope: settings:read
   *   Permission: settings:read
   *   Domain: global
   * @param name_19 The resource name of the user settings.
   * Format: users/{user}/settings
   * @return A successful response.
   */
  UserSettingsServiceGetUserSettingsResponse(name19: string): __Observable<__StrictHttpResponse<V1UserSettings>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name19))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1UserSettings>;
      })
    );
  }
  /**
   * Gets the settings for a user.
   * Authorization:
   *   Scope: settings:read
   *   Permission: settings:read
   *   Domain: global
   * @param name_19 The resource name of the user settings.
   * Format: users/{user}/settings
   * @return A successful response.
   */
  UserSettingsServiceGetUserSettings(name19: string): __Observable<V1UserSettings> {
    return this.UserSettingsServiceGetUserSettingsResponse(name19).pipe(
      __map(_r => _r.body as V1UserSettings)
    );
  }

  /**
   * Updates the settings for a user.
   * Authorization:
   *   Scope: settings:write
   *   Permission: settings:update
   *   Domain: global
   * @param params The `UserSettingsServiceService.UserSettingsServiceUpdateUserSettingsParams` containing the following parameters:
   *
   * - `settings.name`: The resource name of the user settings.
   *   Format: users/{user}/settings
   *
   * - `settings`: The user settings to update.
   *
   * - `allow_missing`: If true and the resource does not exist, a new resource will be created.
   *   In this case, the field mask is ignored.
   *   https://google.aip.dev/134#create-or-update
   *
   * @return A successful response.
   */
  UserSettingsServiceUpdateUserSettingsResponse(params: UserSettingsServiceService.UserSettingsServiceUpdateUserSettingsParams): __Observable<__StrictHttpResponse<V1UserSettings>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.settings;
    if (params.allowMissing != null) __params = __params.set('allow_missing', params.allowMissing.toString());
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.settingsName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1UserSettings>;
      })
    );
  }
  /**
   * Updates the settings for a user.
   * Authorization:
   *   Scope: settings:write
   *   Permission: settings:update
   *   Domain: global
   * @param params The `UserSettingsServiceService.UserSettingsServiceUpdateUserSettingsParams` containing the following parameters:
   *
   * - `settings.name`: The resource name of the user settings.
   *   Format: users/{user}/settings
   *
   * - `settings`: The user settings to update.
   *
   * - `allow_missing`: If true and the resource does not exist, a new resource will be created.
   *   In this case, the field mask is ignored.
   *   https://google.aip.dev/134#create-or-update
   *
   * @return A successful response.
   */
  UserSettingsServiceUpdateUserSettings(params: UserSettingsServiceService.UserSettingsServiceUpdateUserSettingsParams): __Observable<V1UserSettings> {
    return this.UserSettingsServiceUpdateUserSettingsResponse(params).pipe(
      __map(_r => _r.body as V1UserSettings)
    );
  }
}

module UserSettingsServiceService {

  /**
   * Parameters for UserSettingsServiceUpdateUserSettings
   */
  export interface UserSettingsServiceUpdateUserSettingsParams {

    /**
     * The resource name of the user settings.
     * Format: users/{user}/settings
     */
    settingsName: string;

    /**
     * The user settings to update.
     */
    settings: {locale?: string, theme?: string, email_notifications?: boolean, update_time?: string, etag?: string};

    /**
     * If true and the resource does not exist, a new resource will be created.
     * In this case, the field mask is ignored.
     * https://google.aip.dev/134#create-or-update
     */
    allowMissing?: boolean;
  }
}

export { UserSettingsServiceService }
