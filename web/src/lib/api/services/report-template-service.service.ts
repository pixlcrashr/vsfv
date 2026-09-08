/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1GenerateHtmlPreviewResponse } from '../models/v1generate-html-preview-response';
import { V1GenerateHtmlPreviewRequest } from '../models/v1generate-html-preview-request';
import { V1ReportTemplate } from '../models/v1report-template';
import { V1ListReportTemplatesResponse } from '../models/v1list-report-templates-response';

/**
 * ReportTemplateService manages Handlebars templates used for report generation.
 */
@Injectable({
  providedIn: 'root',
})
class ReportTemplateServiceService extends __BaseService {
  static readonly ReportTemplateServiceGenerateHtmlPreviewPath = '/v1/reportTemplates:generateHtmlPreview';
  static readonly ReportTemplateServiceGetReportTemplatePath = '/v1/{name_14}';
  static readonly ReportTemplateServiceDeleteReportTemplatePath = '/v1/{name_8}';
  static readonly ReportTemplateServiceListReportTemplatesPath = '/v1/{parent}/reportTemplates';
  static readonly ReportTemplateServiceCreateReportTemplatePath = '/v1/{parent}/reportTemplates';
  static readonly ReportTemplateServiceUpdateReportTemplatePath = '/v1/{report_template.name}';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Generates an HTML preview from a raw template string.
   * This is a custom method (AIP-136) independent of any single reportTemplate resource.
   * It renders the provided template with sample/fake data for preview purposes.
   * Authorization:
   *   Scope: reportTemplates:read
   *   Permission: reportTemplates:read
   *   Domain: global
   * @param body Request message for generating an HTML preview from a raw template.
   * This is a custom method (AIP-136) independent of any single reportTemplate resource.
   * @return A successful response.
   */
  ReportTemplateServiceGenerateHtmlPreviewResponse(body: V1GenerateHtmlPreviewRequest): __Observable<__StrictHttpResponse<V1GenerateHtmlPreviewResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    __body = body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/reportTemplates:generateHtmlPreview`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1GenerateHtmlPreviewResponse>;
      })
    );
  }
  /**
   * Generates an HTML preview from a raw template string.
   * This is a custom method (AIP-136) independent of any single reportTemplate resource.
   * It renders the provided template with sample/fake data for preview purposes.
   * Authorization:
   *   Scope: reportTemplates:read
   *   Permission: reportTemplates:read
   *   Domain: global
   * @param body Request message for generating an HTML preview from a raw template.
   * This is a custom method (AIP-136) independent of any single reportTemplate resource.
   * @return A successful response.
   */
  ReportTemplateServiceGenerateHtmlPreview(body: V1GenerateHtmlPreviewRequest): __Observable<V1GenerateHtmlPreviewResponse> {
    return this.ReportTemplateServiceGenerateHtmlPreviewResponse(body).pipe(
      __map(_r => _r.body as V1GenerateHtmlPreviewResponse)
    );
  }

  /**
   * Gets a single report template by resource name.
   * Authorization:
   *   Scope: reportTemplates:read
   *   Permission: reportTemplates:read
   *   Domain: organization-scoped
   * @param name_14 The resource name of the report template.
   * Format: organizations/{organization}/reportTemplates/{report_template}
   * @return A successful response.
   */
  ReportTemplateServiceGetReportTemplateResponse(name14: string): __Observable<__StrictHttpResponse<V1ReportTemplate>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name14))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ReportTemplate>;
      })
    );
  }
  /**
   * Gets a single report template by resource name.
   * Authorization:
   *   Scope: reportTemplates:read
   *   Permission: reportTemplates:read
   *   Domain: organization-scoped
   * @param name_14 The resource name of the report template.
   * Format: organizations/{organization}/reportTemplates/{report_template}
   * @return A successful response.
   */
  ReportTemplateServiceGetReportTemplate(name14: string): __Observable<V1ReportTemplate> {
    return this.ReportTemplateServiceGetReportTemplateResponse(name14).pipe(
      __map(_r => _r.body as V1ReportTemplate)
    );
  }

  /**
   * Permanently deletes a report template.
   * Authorization:
   *   Scope: reportTemplates:write
   *   Permission: reportTemplates:delete
   *   Domain: organization-scoped
   * @param name_8 The resource name of the report template.
   * Format: organizations/{organization}/reportTemplates/{report_template}
   * @return A successful response.
   */
  ReportTemplateServiceDeleteReportTemplateResponse(name8: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
      this.rootUrl + `/v1/${encodeURIComponent(String(name8))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<{}>;
      })
    );
  }
  /**
   * Permanently deletes a report template.
   * Authorization:
   *   Scope: reportTemplates:write
   *   Permission: reportTemplates:delete
   *   Domain: organization-scoped
   * @param name_8 The resource name of the report template.
   * Format: organizations/{organization}/reportTemplates/{report_template}
   * @return A successful response.
   */
  ReportTemplateServiceDeleteReportTemplate(name8: string): __Observable<{}> {
    return this.ReportTemplateServiceDeleteReportTemplateResponse(name8).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Lists report templates with pagination.
   * Authorization:
   *   Scope: reportTemplates:read
   *   Permission: reportTemplates:read
   *   Domain: organization-scoped
   * @param params The `ReportTemplateServiceService.ReportTemplateServiceListReportTemplatesParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListReportTemplates call.
   *
   * - `page_size`: Maximum number of templates to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name.
   *   Example: "display_name=\"Monthly\"".
   *
   * @return A successful response.
   */
  ReportTemplateServiceListReportTemplatesResponse(params: ReportTemplateServiceService.ReportTemplateServiceListReportTemplatesParams): __Observable<__StrictHttpResponse<V1ListReportTemplatesResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/reportTemplates`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListReportTemplatesResponse>;
      })
    );
  }
  /**
   * Lists report templates with pagination.
   * Authorization:
   *   Scope: reportTemplates:read
   *   Permission: reportTemplates:read
   *   Domain: organization-scoped
   * @param params The `ReportTemplateServiceService.ReportTemplateServiceListReportTemplatesParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListReportTemplates call.
   *
   * - `page_size`: Maximum number of templates to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name.
   *   Example: "display_name=\"Monthly\"".
   *
   * @return A successful response.
   */
  ReportTemplateServiceListReportTemplates(params: ReportTemplateServiceService.ReportTemplateServiceListReportTemplatesParams): __Observable<V1ListReportTemplatesResponse> {
    return this.ReportTemplateServiceListReportTemplatesResponse(params).pipe(
      __map(_r => _r.body as V1ListReportTemplatesResponse)
    );
  }

  /**
   * Creates a new report template.
   * Authorization:
   *   Scope: reportTemplates:write
   *   Permission: reportTemplates:create
   *   Domain: organization-scoped
   * @param params The `ReportTemplateServiceService.ReportTemplateServiceCreateReportTemplateParams` containing the following parameters:
   *
   * - `report_template`: The report template to create.
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `report_template_id`: The ID to use for the report template. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  ReportTemplateServiceCreateReportTemplateResponse(params: ReportTemplateServiceService.ReportTemplateServiceCreateReportTemplateParams): __Observable<__StrictHttpResponse<V1ReportTemplate>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    __body = params.reportTemplate;

    if (params.reportTemplateId != null) __params = __params.set('report_template_id', params.reportTemplateId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/reportTemplates`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ReportTemplate>;
      })
    );
  }
  /**
   * Creates a new report template.
   * Authorization:
   *   Scope: reportTemplates:write
   *   Permission: reportTemplates:create
   *   Domain: organization-scoped
   * @param params The `ReportTemplateServiceService.ReportTemplateServiceCreateReportTemplateParams` containing the following parameters:
   *
   * - `report_template`: The report template to create.
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `report_template_id`: The ID to use for the report template. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  ReportTemplateServiceCreateReportTemplate(params: ReportTemplateServiceService.ReportTemplateServiceCreateReportTemplateParams): __Observable<V1ReportTemplate> {
    return this.ReportTemplateServiceCreateReportTemplateResponse(params).pipe(
      __map(_r => _r.body as V1ReportTemplate)
    );
  }

  /**
   * Updates an existing report template.
   * Authorization:
   *   Scope: reportTemplates:write
   *   Permission: reportTemplates:update
   *   Domain: organization-scoped
   * @param params The `ReportTemplateServiceService.ReportTemplateServiceUpdateReportTemplateParams` containing the following parameters:
   *
   * - `report_template.name`: The resource name of the report template.
   *   Format: organizations/{organization}/reportTemplates/{report_template}
   *
   * - `report_template`: The report template to update.
   *
   * @return A successful response.
   */
  ReportTemplateServiceUpdateReportTemplateResponse(params: ReportTemplateServiceService.ReportTemplateServiceUpdateReportTemplateParams): __Observable<__StrictHttpResponse<V1ReportTemplate>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.reportTemplate;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.reportTemplateName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ReportTemplate>;
      })
    );
  }
  /**
   * Updates an existing report template.
   * Authorization:
   *   Scope: reportTemplates:write
   *   Permission: reportTemplates:update
   *   Domain: organization-scoped
   * @param params The `ReportTemplateServiceService.ReportTemplateServiceUpdateReportTemplateParams` containing the following parameters:
   *
   * - `report_template.name`: The resource name of the report template.
   *   Format: organizations/{organization}/reportTemplates/{report_template}
   *
   * - `report_template`: The report template to update.
   *
   * @return A successful response.
   */
  ReportTemplateServiceUpdateReportTemplate(params: ReportTemplateServiceService.ReportTemplateServiceUpdateReportTemplateParams): __Observable<V1ReportTemplate> {
    return this.ReportTemplateServiceUpdateReportTemplateResponse(params).pipe(
      __map(_r => _r.body as V1ReportTemplate)
    );
  }
}

module ReportTemplateServiceService {

  /**
   * Parameters for ReportTemplateServiceListReportTemplates
   */
  export interface ReportTemplateServiceListReportTemplatesParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * A page token from a previous ListReportTemplates call.
     */
    pageToken?: string;

    /**
     * Maximum number of templates to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "display_name", "create_time desc").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: display_name.
     * Example: "display_name=\"Monthly\"".
     */
    filter?: string;
  }

  /**
   * Parameters for ReportTemplateServiceCreateReportTemplate
   */
  export interface ReportTemplateServiceCreateReportTemplateParams {

    /**
     * The report template to create.
     */
    reportTemplate: V1ReportTemplate;

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * The ID to use for the report template. If not provided, a system-generated
     * UUID will be used. Must be unique within the parent organization.
     */
    reportTemplateId?: string;
  }

  /**
   * Parameters for ReportTemplateServiceUpdateReportTemplate
   */
  export interface ReportTemplateServiceUpdateReportTemplateParams {

    /**
     * The resource name of the report template.
     * Format: organizations/{organization}/reportTemplates/{report_template}
     */
    reportTemplateName: string;

    /**
     * The report template to update.
     */
    reportTemplate: {uid?: string, display_name: string, template: string, update_time?: string, create_time?: string, etag?: string};
  }
}

export { ReportTemplateServiceService }
