/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1Submission } from '../models/v1submission';
import { SubmissionServiceApproveSubmissionBody } from '../models/submission-service-approve-submission-body';
import { SubmissionServiceCompleteSubmissionBody } from '../models/submission-service-complete-submission-body';
import { SubmissionServiceRejectSubmissionBody } from '../models/submission-service-reject-submission-body';
import { SubmissionServiceRequestFurtherInfoBody } from '../models/submission-service-request-further-info-body';
import { SubmissionServiceSubmitSubmissionBody } from '../models/submission-service-submit-submission-body';
import { SubmissionServiceUndeleteSubmissionBody } from '../models/submission-service-undelete-submission-body';
import { V1ListSubmissionsResponse } from '../models/v1list-submissions-response';
import { V1Direction } from '../models/v1direction';
import { V1Settlement } from '../models/v1settlement';
import { V1Scope } from '../models/v1scope';
import { V1SubmissionStatus } from '../models/v1submission-status';
import { V1PersonDetails } from '../models/v1person-details';
import { V1CommitteeAccountDetails } from '../models/v1committee-account-details';
import { V1PaymentRequestDetails } from '../models/v1payment-request-details';
import { V1Decimal } from '../models/v1decimal';

/**
 * SubmissionService manages submissions (expense claims and income documents).
 */
@Injectable({
  providedIn: 'root',
})
class SubmissionServiceService extends __BaseService {
  static readonly SubmissionServiceGetSubmissionPath = '/v1/{name_13}';
  static readonly SubmissionServiceDeleteSubmissionPath = '/v1/{name_7}';
  static readonly SubmissionServiceApproveSubmissionPath = '/v1/{name}:approve';
  static readonly SubmissionServiceCompleteSubmissionPath = '/v1/{name}:complete';
  static readonly SubmissionServiceRejectSubmissionPath = '/v1/{name}:reject';
  static readonly SubmissionServiceRequestFurtherInfoPath = '/v1/{name}:requestFurtherInfo';
  static readonly SubmissionServiceSubmitSubmissionPath = '/v1/{name}:submit';
  static readonly SubmissionServiceUndeleteSubmissionPath = '/v1/{name}:undelete';
  static readonly SubmissionServiceListSubmissionsPath = '/v1/{parent}/submissions';
  static readonly SubmissionServiceCreateSubmissionPath = '/v1/{parent}/submissions';
  static readonly SubmissionServiceUpdateSubmissionPath = '/v1/{submission.name}';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Gets a single submission by resource name.
   * Authorization:
   *   Scope: submissions:read
   *   Permission: submissions:read or submissions:read_own
   *   Domain: organization-scoped
   * @param name_13 The resource name of the submission.
   * Format: organizations/{organization}/submissions/{submission}
   * @return A successful response.
   */
  SubmissionServiceGetSubmissionResponse(name13: string): __Observable<__StrictHttpResponse<V1Submission>> {
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
        return _r as __StrictHttpResponse<V1Submission>;
      })
    );
  }
  /**
   * Gets a single submission by resource name.
   * Authorization:
   *   Scope: submissions:read
   *   Permission: submissions:read or submissions:read_own
   *   Domain: organization-scoped
   * @param name_13 The resource name of the submission.
   * Format: organizations/{organization}/submissions/{submission}
   * @return A successful response.
   */
  SubmissionServiceGetSubmission(name13: string): __Observable<V1Submission> {
    return this.SubmissionServiceGetSubmissionResponse(name13).pipe(
      __map(_r => _r.body as V1Submission)
    );
  }

  /**
   * Soft-deletes a submission. The submission is purged automatically after
   * the retention period.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:delete or submissions:update_own
   *   Domain: organization-scoped
   * @param name_7 The resource name of the submission.
   * Format: organizations/{organization}/submissions/{submission}
   * @return A successful response.
   */
  SubmissionServiceDeleteSubmissionResponse(name7: string): __Observable<__StrictHttpResponse<V1Submission>> {
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
        return _r as __StrictHttpResponse<V1Submission>;
      })
    );
  }
  /**
   * Soft-deletes a submission. The submission is purged automatically after
   * the retention period.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:delete or submissions:update_own
   *   Domain: organization-scoped
   * @param name_7 The resource name of the submission.
   * Format: organizations/{organization}/submissions/{submission}
   * @return A successful response.
   */
  SubmissionServiceDeleteSubmission(name7: string): __Observable<V1Submission> {
    return this.SubmissionServiceDeleteSubmissionResponse(name7).pipe(
      __map(_r => _r.body as V1Submission)
    );
  }

  /**
   * Approves a submission (PENDING/FURTHER_INFO_REQUIRED → APPROVED, or →
   * COMPLETED for committee-account settlements and income submissions).
   * Treasury only.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceApproveSubmissionParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceApproveSubmissionResponse(params: SubmissionServiceService.SubmissionServiceApproveSubmissionParams): __Observable<__StrictHttpResponse<V1Submission>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:approve`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Submission>;
      })
    );
  }
  /**
   * Approves a submission (PENDING/FURTHER_INFO_REQUIRED → APPROVED, or →
   * COMPLETED for committee-account settlements and income submissions).
   * Treasury only.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceApproveSubmissionParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceApproveSubmission(params: SubmissionServiceService.SubmissionServiceApproveSubmissionParams): __Observable<V1Submission> {
    return this.SubmissionServiceApproveSubmissionResponse(params).pipe(
      __map(_r => _r.body as V1Submission)
    );
  }

  /**
   * Completes an approved submission (APPROVED → COMPLETED), optionally
   * recording the execution date and payment reference. Treasury only.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceCompleteSubmissionParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceCompleteSubmissionResponse(params: SubmissionServiceService.SubmissionServiceCompleteSubmissionParams): __Observable<__StrictHttpResponse<V1Submission>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:complete`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Submission>;
      })
    );
  }
  /**
   * Completes an approved submission (APPROVED → COMPLETED), optionally
   * recording the execution date and payment reference. Treasury only.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceCompleteSubmissionParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceCompleteSubmission(params: SubmissionServiceService.SubmissionServiceCompleteSubmissionParams): __Observable<V1Submission> {
    return this.SubmissionServiceCompleteSubmissionResponse(params).pipe(
      __map(_r => _r.body as V1Submission)
    );
  }

  /**
   * Rejects a submission (→ REJECTED) and records the reason as a comment.
   * Treasury only.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceRejectSubmissionParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceRejectSubmissionResponse(params: SubmissionServiceService.SubmissionServiceRejectSubmissionParams): __Observable<__StrictHttpResponse<V1Submission>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:reject`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Submission>;
      })
    );
  }
  /**
   * Rejects a submission (→ REJECTED) and records the reason as a comment.
   * Treasury only.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceRejectSubmissionParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceRejectSubmission(params: SubmissionServiceService.SubmissionServiceRejectSubmissionParams): __Observable<V1Submission> {
    return this.SubmissionServiceRejectSubmissionResponse(params).pipe(
      __map(_r => _r.body as V1Submission)
    );
  }

  /**
   * Requests further information (PENDING → FURTHER_INFO_REQUIRED) and
   * records the reason as a comment. Treasury only.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceRequestFurtherInfoParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceRequestFurtherInfoResponse(params: SubmissionServiceService.SubmissionServiceRequestFurtherInfoParams): __Observable<__StrictHttpResponse<V1Submission>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:requestFurtherInfo`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Submission>;
      })
    );
  }
  /**
   * Requests further information (PENDING → FURTHER_INFO_REQUIRED) and
   * records the reason as a comment. Treasury only.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceRequestFurtherInfoParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceRequestFurtherInfo(params: SubmissionServiceService.SubmissionServiceRequestFurtherInfoParams): __Observable<V1Submission> {
    return this.SubmissionServiceRequestFurtherInfoResponse(params).pipe(
      __map(_r => _r.body as V1Submission)
    );
  }

  /**
   * Submits a draft for review (DRAFT → PENDING). Validates that the
   * submission is complete.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update or submissions:update_own
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceSubmitSubmissionParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceSubmitSubmissionResponse(params: SubmissionServiceService.SubmissionServiceSubmitSubmissionParams): __Observable<__StrictHttpResponse<V1Submission>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:submit`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Submission>;
      })
    );
  }
  /**
   * Submits a draft for review (DRAFT → PENDING). Validates that the
   * submission is complete.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update or submissions:update_own
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceSubmitSubmissionParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceSubmitSubmission(params: SubmissionServiceService.SubmissionServiceSubmitSubmissionParams): __Observable<V1Submission> {
    return this.SubmissionServiceSubmitSubmissionResponse(params).pipe(
      __map(_r => _r.body as V1Submission)
    );
  }

  /**
   * Restores a soft-deleted submission.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:delete
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceUndeleteSubmissionParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceUndeleteSubmissionResponse(params: SubmissionServiceService.SubmissionServiceUndeleteSubmissionParams): __Observable<__StrictHttpResponse<V1Submission>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.body;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.name))}:undelete`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Submission>;
      })
    );
  }
  /**
   * Restores a soft-deleted submission.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:delete
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceUndeleteSubmissionParams` containing the following parameters:
   *
   * - `name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `body`:
   *
   * @return A successful response.
   */
  SubmissionServiceUndeleteSubmission(params: SubmissionServiceService.SubmissionServiceUndeleteSubmissionParams): __Observable<V1Submission> {
    return this.SubmissionServiceUndeleteSubmissionResponse(params).pipe(
      __map(_r => _r.body as V1Submission)
    );
  }

  /**
   * Lists submissions with pagination and optional filters. Drafts are only
   * included when explicitly filtered by status.
   * Authorization:
   *   Scope: submissions:read
   *   Permission: submissions:read or submissions:read_own
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceListSubmissionsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `show_deleted`: Whether to include soft-deleted submissions in the result.
   *
   * - `page_token`: A page token from a previous ListSubmissions call.
   *
   * - `page_size`: Maximum number of submissions to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: direction, settlement, status, committee, created_by_user.
   *   Example: "committee=\"organizations/{organization}/committees/{committee}\" AND status=\"PENDING\"".
   *
   * @return A successful response.
   */
  SubmissionServiceListSubmissionsResponse(params: SubmissionServiceService.SubmissionServiceListSubmissionsParams): __Observable<__StrictHttpResponse<V1ListSubmissionsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.showDeleted != null) __params = __params.set('show_deleted', params.showDeleted.toString());
    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    if (params.orderBy != null) __params = __params.set('order_by', params.orderBy.toString());
    if (params.filter != null) __params = __params.set('filter', params.filter.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/submissions`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListSubmissionsResponse>;
      })
    );
  }
  /**
   * Lists submissions with pagination and optional filters. Drafts are only
   * included when explicitly filtered by status.
   * Authorization:
   *   Scope: submissions:read
   *   Permission: submissions:read or submissions:read_own
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceListSubmissionsParams` containing the following parameters:
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `show_deleted`: Whether to include soft-deleted submissions in the result.
   *
   * - `page_token`: A page token from a previous ListSubmissions call.
   *
   * - `page_size`: Maximum number of submissions to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * - `order_by`: Order by expression (e.g. "create_time desc").
   *
   * - `filter`: Filter expression conforming to AIP-160.
   *   Supported fields: direction, settlement, status, committee, created_by_user.
   *   Example: "committee=\"organizations/{organization}/committees/{committee}\" AND status=\"PENDING\"".
   *
   * @return A successful response.
   */
  SubmissionServiceListSubmissions(params: SubmissionServiceService.SubmissionServiceListSubmissionsParams): __Observable<V1ListSubmissionsResponse> {
    return this.SubmissionServiceListSubmissionsResponse(params).pipe(
      __map(_r => _r.body as V1ListSubmissionsResponse)
    );
  }

  /**
   * Creates a new submission in the DRAFT state.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:create
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceCreateSubmissionParams` containing the following parameters:
   *
   * - `submission`: The submission to create. Submissions are always created in the DRAFT
   *   state, so the request may omit fields that are still unknown; all fields
   *   are validated on submit.
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `submission_id`: The ID to use for the submission. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  SubmissionServiceCreateSubmissionResponse(params: SubmissionServiceService.SubmissionServiceCreateSubmissionParams): __Observable<__StrictHttpResponse<V1Submission>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;
    __body = params.submission;

    if (params.submissionId != null) __params = __params.set('submission_id', params.submissionId.toString());
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/submissions`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Submission>;
      })
    );
  }
  /**
   * Creates a new submission in the DRAFT state.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:create
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceCreateSubmissionParams` containing the following parameters:
   *
   * - `submission`: The submission to create. Submissions are always created in the DRAFT
   *   state, so the request may omit fields that are still unknown; all fields
   *   are validated on submit.
   *
   * - `parent`: The parent organization resource name.
   *   Format: organizations/{organization}
   *
   * - `submission_id`: The ID to use for the submission. If not provided, a system-generated
   *   UUID will be used. Must be unique within the parent organization.
   *
   * @return A successful response.
   */
  SubmissionServiceCreateSubmission(params: SubmissionServiceService.SubmissionServiceCreateSubmissionParams): __Observable<V1Submission> {
    return this.SubmissionServiceCreateSubmissionResponse(params).pipe(
      __map(_r => _r.body as V1Submission)
    );
  }

  /**
   * Updates an existing submission. Only allowed while the submission is in
   * DRAFT, PENDING or FURTHER_INFO_REQUIRED state, and only by the submitter
   * or the treasury. Updating the scope requires the treasury update
   * permission.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update or submissions:update_own
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceUpdateSubmissionParams` containing the following parameters:
   *
   * - `submission.name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `submission`: The submission to update.
   *
   * @return A successful response.
   */
  SubmissionServiceUpdateSubmissionResponse(params: SubmissionServiceService.SubmissionServiceUpdateSubmissionParams): __Observable<__StrictHttpResponse<V1Submission>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.submission;
    let req = new HttpRequest<any>(
      'PATCH',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.submissionName))}`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1Submission>;
      })
    );
  }
  /**
   * Updates an existing submission. Only allowed while the submission is in
   * DRAFT, PENDING or FURTHER_INFO_REQUIRED state, and only by the submitter
   * or the treasury. Updating the scope requires the treasury update
   * permission.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:update or submissions:update_own
   *   Domain: organization-scoped
   * @param params The `SubmissionServiceService.SubmissionServiceUpdateSubmissionParams` containing the following parameters:
   *
   * - `submission.name`: The resource name of the submission.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `submission`: The submission to update.
   *
   * @return A successful response.
   */
  SubmissionServiceUpdateSubmission(params: SubmissionServiceService.SubmissionServiceUpdateSubmissionParams): __Observable<V1Submission> {
    return this.SubmissionServiceUpdateSubmissionResponse(params).pipe(
      __map(_r => _r.body as V1Submission)
    );
  }
}

module SubmissionServiceService {

  /**
   * Parameters for SubmissionServiceApproveSubmission
   */
  export interface SubmissionServiceApproveSubmissionParams {

    /**
     * The resource name of the submission.
     * Format: organizations/{organization}/submissions/{submission}
     */
    name: string;
    body: SubmissionServiceApproveSubmissionBody;
  }

  /**
   * Parameters for SubmissionServiceCompleteSubmission
   */
  export interface SubmissionServiceCompleteSubmissionParams {

    /**
     * The resource name of the submission.
     * Format: organizations/{organization}/submissions/{submission}
     */
    name: string;
    body: SubmissionServiceCompleteSubmissionBody;
  }

  /**
   * Parameters for SubmissionServiceRejectSubmission
   */
  export interface SubmissionServiceRejectSubmissionParams {

    /**
     * The resource name of the submission.
     * Format: organizations/{organization}/submissions/{submission}
     */
    name: string;
    body: SubmissionServiceRejectSubmissionBody;
  }

  /**
   * Parameters for SubmissionServiceRequestFurtherInfo
   */
  export interface SubmissionServiceRequestFurtherInfoParams {

    /**
     * The resource name of the submission.
     * Format: organizations/{organization}/submissions/{submission}
     */
    name: string;
    body: SubmissionServiceRequestFurtherInfoBody;
  }

  /**
   * Parameters for SubmissionServiceSubmitSubmission
   */
  export interface SubmissionServiceSubmitSubmissionParams {

    /**
     * The resource name of the submission.
     * Format: organizations/{organization}/submissions/{submission}
     */
    name: string;
    body: SubmissionServiceSubmitSubmissionBody;
  }

  /**
   * Parameters for SubmissionServiceUndeleteSubmission
   */
  export interface SubmissionServiceUndeleteSubmissionParams {

    /**
     * The resource name of the submission.
     * Format: organizations/{organization}/submissions/{submission}
     */
    name: string;
    body: SubmissionServiceUndeleteSubmissionBody;
  }

  /**
   * Parameters for SubmissionServiceListSubmissions
   */
  export interface SubmissionServiceListSubmissionsParams {

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * Whether to include soft-deleted submissions in the result.
     */
    showDeleted?: boolean;

    /**
     * A page token from a previous ListSubmissions call.
     */
    pageToken?: string;

    /**
     * Maximum number of submissions to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;

    /**
     * Order by expression (e.g. "create_time desc").
     */
    orderBy?: string;

    /**
     * Filter expression conforming to AIP-160.
     * Supported fields: direction, settlement, status, committee, created_by_user.
     * Example: "committee=\"organizations/{organization}/committees/{committee}\" AND status=\"PENDING\"".
     */
    filter?: string;
  }

  /**
   * Parameters for SubmissionServiceCreateSubmission
   */
  export interface SubmissionServiceCreateSubmissionParams {

    /**
     * The submission to create. Submissions are always created in the DRAFT
     * state, so the request may omit fields that are still unknown; all fields
     * are validated on submit.
     */
    submission: V1Submission;

    /**
     * The parent organization resource name.
     * Format: organizations/{organization}
     */
    parent: string;

    /**
     * The ID to use for the submission. If not provided, a system-generated
     * UUID will be used. Must be unique within the parent organization.
     */
    submissionId?: string;
  }

  /**
   * Parameters for SubmissionServiceUpdateSubmission
   */
  export interface SubmissionServiceUpdateSubmissionParams {

    /**
     * The resource name of the submission.
     * Format: organizations/{organization}/submissions/{submission}
     */
    submissionName: string;

    /**
     * The submission to update.
     */
    submission: {uid?: string, public_id?: string, created_by_user?: string, committee: string, direction: V1Direction, settlement?: V1Settlement, scope: V1Scope, status?: V1SubmissionStatus, notice?: string, person_details?: V1PersonDetails, committee_account_details?: V1CommitteeAccountDetails, payment_request_details?: V1PaymentRequestDetails, total_amount?: V1Decimal, etag?: string, delete_time?: string, purge_time?: string, update_time?: string, create_time?: string};
  }
}

export { SubmissionServiceService }
