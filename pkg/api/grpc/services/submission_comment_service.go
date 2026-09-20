package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

var (
	statusSubmissionCommentRequired    = status.New(codes.InvalidArgument, "comment is required")
	statusFailedListSubmissionComments = status.New(codes.Internal, "failed to list submission comments")
	statusFailedCreateComment          = status.New(codes.Internal, "failed to create comment")
)

// submissionCommentServiceServer implements gen.SubmissionCommentServiceServer.
type submissionCommentServiceServer struct {
	repo     *repository.SubmissionRepository
	enforcer *authz.Enforcer
}

func newSubmissionCommentServiceServer(repo *repository.SubmissionRepository, enforcer *authz.Enforcer) gen.SubmissionCommentServiceServer {
	return &submissionCommentServiceServer{repo: repo, enforcer: enforcer}
}

func submissionCommentToProto(n gen.SubmissionCommentResourceName, m *model.SubmissionComment) *gen.SubmissionComment {
	p := &gen.SubmissionComment{
		Name:        n.String(),
		Uid:         m.ID.String(),
		Content:     m.Content,
		IsAdminOnly: m.IsAdminOnly,
		CreateTime:  timestamppb.New(m.CreatedAt),
	}
	if m.AuthorUserID.Valid {
		p.CreatedByUser = "users/" + m.AuthorUserID.UUID.String()
	}
	if m.StatusFrom != 0 || m.StatusTo != 0 {
		p.StatusChange = &gen.SubmissionStatusChange{
			From: gen.SubmissionStatus(m.StatusFrom),
			To:   gen.SubmissionStatus(m.StatusTo),
		}
	}
	return p
}

func (s *submissionCommentServiceServer) ListSubmissionComments(ctx context.Context, req *gen.ListSubmissionCommentsRequest) (*gen.ListSubmissionCommentsResponse, error) {
	var pn gen.SubmissionResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	submissionID, err := uuid.Parse(pn.Submission)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	parent, err := s.repo.GetByID(ctx, submissionID)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedListSubmissionComments}
	}

	if err := checkSubmissionRead(ctx, s.enforcer, pn.Organization, parent); err != nil {
		return nil, err
	}

	// Admin-only comments are visible to treasury-level viewers only.
	includeAdminOnly :=
		authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionComment, authz.OrgDomain(pn.Organization)) == nil ||
			authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionRead, authz.OrgDomain(pn.Organization)) == nil

	comments, err := s.repo.ListComments(ctx, submissionID, includeAdminOnly)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListSubmissionComments}
	}

	resp := &gen.ListSubmissionCommentsResponse{}
	for _, m := range comments {
		resp.Comments = append(resp.Comments, submissionCommentToProto(
			gen.SubmissionCommentResourceName{Organization: pn.Organization, Submission: pn.Submission, Comment: m.ID.String()}, m,
		))
	}
	return resp, nil
}

func (s *submissionCommentServiceServer) CreateSubmissionComment(ctx context.Context, req *gen.CreateSubmissionCommentRequest) (*gen.SubmissionComment, error) {
	if req.Comment == nil {
		return nil, &ServerError{Status: statusSubmissionCommentRequired}
	}

	var pn gen.SubmissionResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	submissionID, err := uuid.Parse(pn.Submission)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	parent, err := s.repo.GetByID(ctx, submissionID)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedCreateComment}
	}

	if err := checkSubmissionComment(ctx, s.enforcer, pn.Organization, parent); err != nil {
		return nil, err
	}

	// Only treasury-level commenters may file admin-only comments.
	if req.Comment.IsAdminOnly &&
		authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionComment, authz.OrgDomain(pn.Organization)) != nil {
		return nil, &ServerError{Status: statusPermissionDenied}
	}

	m := &model.SubmissionComment{
		SubmissionID: submissionID,
		Content:      req.Comment.Content,
		IsAdminOnly:  req.Comment.IsAdminOnly,
	}
	if user, ok := authz.UserIDFromContext(ctx); ok {
		if uid, err := uuid.Parse(user); err == nil {
			m.AuthorUserID = uuid.NullUUID{Valid: true, UUID: uid}
		}
	}

	if err := s.repo.CreateComment(ctx, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedCreateComment}
	}

	return submissionCommentToProto(
		gen.SubmissionCommentResourceName{Organization: pn.Organization, Submission: pn.Submission, Comment: m.ID.String()}, m,
	), nil
}
