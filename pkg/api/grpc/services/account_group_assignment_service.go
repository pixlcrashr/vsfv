package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"go.einride.tech/aip/ordering"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

var (
	statusInvalidParentAccountGroupName = status.New(codes.InvalidArgument, "invalid parent account_group name")
)

type accountGroupAssignmentServiceServer struct {
	gen.UnimplementedAccountGroupAssignmentServiceServer
	repo     *repository.AccountGroupAssignmentRepository
	audits   *auditWriter
	enforcer *authz.Enforcer
}

func newAccountGroupAssignmentServiceServer(repo *repository.AccountGroupAssignmentRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.AccountGroupAssignmentServiceServer {
	return &accountGroupAssignmentServiceServer{repo: repo, audits: audits, enforcer: enforcer}
}

func (s *accountGroupAssignmentServiceServer) GetAccountGroupAssignment(ctx context.Context, req *gen.GetAccountGroupAssignmentRequest) (*gen.AccountGroupAssignment, error) {
	var n gen.AccountGroupAssignmentResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAssignmentName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccountGroups, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	assignID, err := uuid.Parse(n.Assignment)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAssignmentName}
	}

	m, err := s.repo.GetByID(ctx, assignID)
	if err != nil {
		if errors.Is(err, repository.ErrAccountGroupAssignmentNotFound) {
			return nil, &ServerError{Err: err, Status: statusAssignmentNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetAssignment}
	}

	return AccountGroupAssignmentToProto(n.AccountGroupResourceName(), m), nil
}

func (s *accountGroupAssignmentServiceServer) ListAccountGroupAssignments(ctx context.Context, req *gen.ListAccountGroupAssignmentsRequest) (*gen.ListAccountGroupAssignmentsResponse, error) {
	var pn gen.AccountGroupResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentAccountGroupName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccountGroups, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	groupID, err := uuid.Parse(pn.AccountGroup)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentAccountGroupName}
	}

	c, err := svcfilter.ParseAccountGroupAssignmentFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	offset, err := pagetoken.Decode(req.PageToken)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidPageToken}
	}

	pageSize := normalizePageSize(req.PageSize)

	// Parse order_by
	orderBy, err := ordering.ParseOrderBy(req)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrderBy}
	}

	orderExprs, _ := order.Resolve(orderBy, repository.AccountGroupAssignmentOrderFieldMapper)

	params := repository.ListAccountGroupAssignmentsParams{
		AccountGroupID: groupID,
		Page:           int(offset/int64(pageSize)) + 1,
		PageSize:       pageSize,
		Cond:           c,
		OrderBy:        orderExprs,
	}

	ms, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListAssignments}
	}

	resp := &gen.ListAccountGroupAssignmentsResponse{TotalSize: total}
	for _, m := range ms {
		resp.Assignments = append(resp.Assignments, AccountGroupAssignmentToProto(pn, m))
	}

	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}

	return resp, nil
}

func (s *accountGroupAssignmentServiceServer) CreateAccountGroupAssignment(ctx context.Context, req *gen.CreateAccountGroupAssignmentRequest) (*gen.AccountGroupAssignment, error) {
	var pn gen.AccountGroupResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentAccountGroupName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccountGroups, authz.ActionCreate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	groupID, err := uuid.Parse(pn.AccountGroup)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentAccountGroupName}
	}

	if req.Assignment == nil {
		return nil, &ServerError{Status: statusAssignmentRequired}
	}

	accountID, err := uuid.Parse(req.Assignment.AccountId)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountID}
	}

	m, err := s.repo.Create(ctx, repository.CreateAccountGroupAssignmentParams{
		AccountGroupID: groupID,
		AccountID:      accountID,
		Negate:         req.Assignment.Negate,
		CustomID:       req.AccountGroupAssignmentId,
	})
	if err != nil {
		if errors.Is(err, repository.ErrAccountGroupAssignmentAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusAssignmentAlreadyExists}
		}

		if errors.Is(err, repository.ErrAccountGroupNotFound) {
			return nil, &ServerError{Err: err, Status: statusAccountGroupNotFound}
		}

		if errors.Is(err, repository.ErrAccountNotFound) {
			return nil, &ServerError{Err: err, Status: statusAccountNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedCreateAssignment}
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentAccountGroupName}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		pn.AccountGroupAssignmentResourceName(m.CustomID).String(), orgID, m.ID,
	), AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return AccountGroupAssignmentToProto(pn, m), nil
}

func (s *accountGroupAssignmentServiceServer) UpdateAccountGroupAssignment(ctx context.Context, req *gen.UpdateAccountGroupAssignmentRequest) (*gen.AccountGroupAssignment, error) {
	if req.Assignment == nil {
		return nil, &ServerError{Status: statusAssignmentRequired}
	}

	var n gen.AccountGroupAssignmentResourceName

	if err := n.UnmarshalString(req.Assignment.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAssignmentName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccountGroups, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	assignID, err := uuid.Parse(n.Assignment)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAssignmentName}
	}

	m, err := s.repo.GetByID(ctx, assignID)
	if err != nil {
		if errors.Is(err, repository.ErrAccountGroupAssignmentNotFound) {
			return nil, &ServerError{Err: err, Status: statusAssignmentNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetAssignment}
	}

	before := *m

	updateParams := repository.UpdateAccountGroupAssignmentParams{
		Negate: optional.From(req.Assignment.Negate),
	}

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateAssignment}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateAssignment}
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAssignmentName}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return AccountGroupAssignmentToProto(n.AccountGroupResourceName(), m), nil
}

func (s *accountGroupAssignmentServiceServer) DeleteAccountGroupAssignment(ctx context.Context, req *gen.DeleteAccountGroupAssignmentRequest) (*emptypb.Empty, error) {
	var n gen.AccountGroupAssignmentResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAssignmentName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccountGroups, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	assignID, err := uuid.Parse(n.Assignment)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAssignmentName}
	}

	m, err := s.repo.GetByID(ctx, assignID)
	if err != nil {
		if errors.Is(err, repository.ErrAccountGroupAssignmentNotFound) {
			return nil, &ServerError{Err: err, Status: statusAssignmentNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetAssignment}
	}

	if err := s.repo.Delete(ctx, assignID); err != nil {
		if errors.Is(err, repository.ErrAccountGroupAssignmentNotFound) {
			return nil, &ServerError{Err: err, Status: statusAssignmentNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedDeleteAssignment}
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAssignmentName}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionDelete, m, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}
