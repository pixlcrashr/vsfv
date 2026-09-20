/* tslint:disable */
import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { BaseService as __BaseService } from '../base-service';
import { ApiConfiguration as __Configuration } from '../api-configuration';
import { StrictHttpResponse as __StrictHttpResponse } from '../strict-http-response';
import { Observable as __Observable } from 'rxjs';
import { map as __map, filter as __filter } from 'rxjs/operators';

import { V1ListSubmissionCommentsResponse } from '../models/v1list-submission-comments-response';
import { V1SubmissionComment } from '../models/v1submission-comment';

/**
 * SubmissionCommentService manages the comments of a submission.
 */
@Injectable({
  providedIn: 'root',
})
class SubmissionCommentServiceService extends __BaseService {
  static readonly SubmissionCommentServiceListSubmissionCommentsPath = '/v1/{parent}/comments';
  static readonly SubmissionCommentServiceCreateSubmissionCommentPath = '/v1/{parent}/comments';

  constructor(
    config: __Configuration,
    http: HttpClient
  ) {
    super(config, http);
  }

  /**
   * Lists the comments of a submission. Admin-only comments are omitted for
   * requesters without the treasury comment permission.
   * Authorization:
   *   Scope: submissions:read
   *   Permission: submissions:read, submissions:read_own, submissions:comment or submissions:comment_own
   *   Domain: organization-scoped
   * @param params The `SubmissionCommentServiceService.SubmissionCommentServiceListSubmissionCommentsParams` containing the following parameters:
   *
   * - `parent`: The parent submission resource name.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `page_token`: A page token from a previous ListSubmissionComments call.
   *
   * - `page_size`: Maximum number of comments to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * @return A successful response.
   */
  SubmissionCommentServiceListSubmissionCommentsResponse(params: SubmissionCommentServiceService.SubmissionCommentServiceListSubmissionCommentsParams): __Observable<__StrictHttpResponse<V1ListSubmissionCommentsResponse>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    if (params.pageToken != null) __params = __params.set('page_token', params.pageToken.toString());
    if (params.pageSize != null) __params = __params.set('page_size', params.pageSize.toString());
    let req = new HttpRequest<any>(
      'GET',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/comments`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1ListSubmissionCommentsResponse>;
      })
    );
  }
  /**
   * Lists the comments of a submission. Admin-only comments are omitted for
   * requesters without the treasury comment permission.
   * Authorization:
   *   Scope: submissions:read
   *   Permission: submissions:read, submissions:read_own, submissions:comment or submissions:comment_own
   *   Domain: organization-scoped
   * @param params The `SubmissionCommentServiceService.SubmissionCommentServiceListSubmissionCommentsParams` containing the following parameters:
   *
   * - `parent`: The parent submission resource name.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `page_token`: A page token from a previous ListSubmissionComments call.
   *
   * - `page_size`: Maximum number of comments to return. The service may return fewer.
   *   If unspecified, at most 20 are returned. Maximum value is 100.
   *
   * @return A successful response.
   */
  SubmissionCommentServiceListSubmissionComments(params: SubmissionCommentServiceService.SubmissionCommentServiceListSubmissionCommentsParams): __Observable<V1ListSubmissionCommentsResponse> {
    return this.SubmissionCommentServiceListSubmissionCommentsResponse(params).pipe(
      __map(_r => _r.body as V1ListSubmissionCommentsResponse)
    );
  }

  /**
   * Creates a comment on a submission.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:comment or submissions:comment_own
   *   Domain: organization-scoped
   * @param params The `SubmissionCommentServiceService.SubmissionCommentServiceCreateSubmissionCommentParams` containing the following parameters:
   *
   * - `parent`: The parent submission resource name.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `comment`: The comment to create.
   *
   * @return A successful response.
   */
  SubmissionCommentServiceCreateSubmissionCommentResponse(params: SubmissionCommentServiceService.SubmissionCommentServiceCreateSubmissionCommentParams): __Observable<__StrictHttpResponse<V1SubmissionComment>> {
    let __params = this.newParams();
    let __headers = new HttpHeaders();
    let __body: any = null;

    __body = params.comment;
    let req = new HttpRequest<any>(
      'POST',
      this.rootUrl + `/v1/${encodeURIComponent(String(params.parent))}/comments`,
      __body,
      {
        headers: __headers,
        params: __params,
        responseType: 'json'
      });

    return this.http.request<any>(req).pipe(
      __filter(_r => _r instanceof HttpResponse),
      __map((_r) => {
        return _r as __StrictHttpResponse<V1SubmissionComment>;
      })
    );
  }
  /**
   * Creates a comment on a submission.
   * Authorization:
   *   Scope: submissions:write
   *   Permission: submissions:comment or submissions:comment_own
   *   Domain: organization-scoped
   * @param params The `SubmissionCommentServiceService.SubmissionCommentServiceCreateSubmissionCommentParams` containing the following parameters:
   *
   * - `parent`: The parent submission resource name.
   *   Format: organizations/{organization}/submissions/{submission}
   *
   * - `comment`: The comment to create.
   *
   * @return A successful response.
   */
  SubmissionCommentServiceCreateSubmissionComment(params: SubmissionCommentServiceService.SubmissionCommentServiceCreateSubmissionCommentParams): __Observable<V1SubmissionComment> {
    return this.SubmissionCommentServiceCreateSubmissionCommentResponse(params).pipe(
      __map(_r => _r.body as V1SubmissionComment)
    );
  }
}

module SubmissionCommentServiceService {

  /**
   * Parameters for SubmissionCommentServiceListSubmissionComments
   */
  export interface SubmissionCommentServiceListSubmissionCommentsParams {

    /**
     * The parent submission resource name.
     * Format: organizations/{organization}/submissions/{submission}
     */
    parent: string;

    /**
     * A page token from a previous ListSubmissionComments call.
     */
    pageToken?: string;

    /**
     * Maximum number of comments to return. The service may return fewer.
     * If unspecified, at most 20 are returned. Maximum value is 100.
     */
    pageSize?: number;
  }

  /**
   * Parameters for SubmissionCommentServiceCreateSubmissionComment
   */
  export interface SubmissionCommentServiceCreateSubmissionCommentParams {

    /**
     * The parent submission resource name.
     * Format: organizations/{organization}/submissions/{submission}
     */
    parent: string;

    /**
     * The comment to create.
     */
    comment: V1SubmissionComment;
  }
}

export { SubmissionCommentServiceService }
