/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1Report } from '../models/v1report';
import { V1ListReportsResponse } from '../models/v1list-reports-response';

/**
 * ReportService manages generated report instances.
 * Note: report file download is handled exclusively by the Huma HTTP API.
 */
@Injectable({
  providedIn: 'root',
})
class ReportServiceService extends __BaseService {
  static readonly ReportServiceGetReportPath = '/v1/{name_13}';
  static readonly ReportServiceDeleteReportPath = '/v1/{name_7}';
  static readonly ReportServiceListReportsPath = '/v1/{parent}/reports';
  static readonly ReportServiceCreateReportPath = '/v1/{parent}/reports';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Gets report metadata by resource name.
   * Authorization:
   *   Scope: reports:read
   *   Permission: reports:read
   *   Domain: organization-scoped
   * @param name_13 The resource name of the report.
   * Format: organizations/{organization}/reports/{report}
   * @return A successful response.
   */
  ReportServiceGetReportResponse(name13: string): __Observable<__StrictHttpResponse<V1Report>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(name13))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Report>;
      })
    );
  }
  /**
   * Gets report metadata by resource name.
   * Authorization:
   *   Scope: reports:read
   *   Permission: reports:read
   *   Domain: organization-scoped
   * @param name_13 The resource name of the report.
   * Format: organizations/{organization}/reports/{report}
   * @return A successful response.
   */
  ReportServiceGetReport(name13: string): __Observable<V1Report> {
    return this.ReportServiceGetReportResponse(name13).pipe(
      __map(_r => _r.body as V1Report)
    );
  }

  /**
   * Permanently deletes a report.
   * Authorization:
   *   Scope: reports:write
   *   Permission: reports:delete
   *   Domain: organization-scoped
   * @param name_7 The resource name of the report.
   * Format: organizations/{organization}/reports/{report}
   * @return A successful response.
   */
  ReportServiceDeleteReportResponse(name7: string): __Observable<__StrictHttpResponse<{}>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    let req = new HttpRequest<any>(
      'DELETE',
      this.rootUrl + `/v1/${encodeURIComponent(String(name7))}`,
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
   * Permanently deletes a report.
   * Authorization:
   *   Scope: reports:write
   *   Permission: reports:delete
   *   Domain: organization-scoped
   * @param name_7 The resource name of the report.
   * Format: organizations/{organization}/reports/{report}
   * @return A successful response.
   */
  ReportServiceDeleteReport(name7: string): __Observable<{}> {
    return this.ReportServiceDeleteReportResponse(name7).pipe(
      __map(_r => _r.body as {})
    );
  }

  /**
   * Lists reports with pagination.
   * Authorization:
   *   Scope: reports:read
   *   Permission: reports:read
   *   Domain: organization-scoped
   * @param params The `ReportServiceService.ReportServiceListReportsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListReports call.
   *
   * - `page_size`: Maximum number of reports to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name, report_template_id.
   *   Example: "display_name=\"Q1 Report\"".
   *
   * @return A successful response.
   */
  ReportServiceListReportsResponse(params: ReportServiceService.ReportServiceListReportsParams): __Observable<__StrictHttpResponse<V1ListReportsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/reports`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListReportsResponse>;
      })
    );
  }
  /**
   * Lists reports with pagination.
   * Authorization:
   *   Scope: reports:read
   *   Permission: reports:read
   *   Domain: organization-scoped
   * @param params The `ReportServiceService.ReportServiceListReportsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `page_token`: A page token from a previous ListReports call.
   *
   * - `page_size`: Maximum number of reports to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "display_name", "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: display_name, report_template_id.
   *   Example: "display_name=\"Q1 Report\"".
   *
   * @return A successful response.
   */
  ReportServiceListReports(params: ReportServiceService.ReportServiceListReportsParams): __Observable<V1ListReportsResponse> {
    return this.ReportServiceListReportsResponse(params).pipe(
      __map(_r => _r.body as V1ListReportsResponse)
    );
  }

  /**
   * Creates a new report by rendering a template.
   * Authorization:
   *   Scope: reports:write
   *   Permission: reports:create
   *   Domain: organization-scoped
   * @param params The `ReportServiceService.ReportServiceCreateReportParams` containing the following parameters:
   *
   * - `report`: The report to create.
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `report_id`: The ID to use for the report. If not provided, a system-generated UUID
   *   will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  ReportServiceCreateReportResponse(params: ReportServiceService.ReportServiceCreateReportParams): __Observable<__StrictHttpResponse<V1Report>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    __body = params.report;

    if (params.reportId != null) __params = __params.set('report_id', params.reportId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/reports`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Report>;
      })
    );
  }
  /**
   * Creates a new report by rendering a template.
   * Authorization:
   *   Scope: reports:write
   *   Permission: reports:create
   *   Domain: organization-scoped
   * @param params The `ReportServiceService.ReportServiceCreateReportParams` containing the following parameters:
   *
   * - `report`: The report to create.
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `report_id`: The ID to use for the report. If not provided, a system-generated UUID
   *   will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  ReportServiceCreateReport(params: ReportServiceService.ReportServiceCreateReportParams): __Observable<V1Report> {
    return this.ReportServiceCreateReportResponse(params).pipe(
      __map(_r => _r.body as V1Report)
    );
  }
}

module ReportServiceService {

  /**
   * Parameters for ReportServiceListReports
   */
  export interface ReportServiceListReportsParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * A page token from a previous ListReports call.
     */
    pageToken?: string;

    /**
     * Maximum number of reports to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "display_name", "create_time desc").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: display_name, report_template_id.
     * Example: "display_name=\"Q1 Report\"".
     */
    filter?: string;
  }

  /**
   * Parameters for ReportServiceCreateReport
   */
  export interface ReportServiceCreateReportParams {

    /**
     * The report to create.
     */
    report: V1Report;

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * The ID to use for the report. If not provided, a system-generated UUID
     * will be used. Must be unique within the parent organization.
     */
    reportId?: string;
  }
}

export { ReportServiceService }
