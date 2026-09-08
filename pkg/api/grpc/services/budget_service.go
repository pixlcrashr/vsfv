package services

import (
	"context"
	"database/sql"
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
	statusBudgetRequired                  = status.New(codes.InvalidArgument, "budget is required")
	statusInvalidBudgetName               = status.New(codes.InvalidArgument, "invalid budget name")
	statusInvalidOrganizationInBudgetName = status.New(codes.InvalidArgument, "invalid organization in budget name")
	statusBudgetNotFound                  = status.New(codes.NotFound, "budget not found")
	statusBudgetAlreadyExists             = status.New(codes.AlreadyExists, "budget with this ID already exists")
	statusFailedGetBudget                 = status.New(codes.Internal, "failed to get budget")
	statusFailedListBudgets               = status.New(codes.Internal, "failed to list budgets")
	statusFailedCreateBudget              = status.New(codes.Internal, "failed to create budget")
	statusFailedUpdateBudget              = status.New(codes.Internal, "failed to update budget")
	statusFailedCloseBudget               = status.New(codes.Internal, "failed to close budget")
	statusFailedDeleteBudget              = status.New(codes.Internal, "failed to delete budget")
	statusInvalidPublishActualValuesUntil = status.New(codes.InvalidArgument, "publish_actual_values_until must lie within the budget period")
)

type budgetServiceServer struct {
	gen.UnimplementedBudgetServiceServer
	repo     *repository.BudgetRepository
	audits   *auditWriter
	enforcer *authz.Enforcer
}

func newBudgetServiceServer(repo *repository.BudgetRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.BudgetServiceServer {
	return &budgetServiceServer{repo: repo, audits: audits, enforcer: enforcer}
}

func (s *budgetServiceServer) GetBudget(ctx context.Context, req *gen.GetBudgetRequest) (*gen.Budget, error) {
	var n gen.BudgetResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidBudgetName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInBudgetName}
	}

	// Use CustomID (n.Budget) instead of parsing as UUID
	m, err := s.repo.GetByCustomID(ctx, orgID, n.Budget)
	if err != nil {
		if errors.Is(err, repository.ErrBudgetNotFound) {
			return nil, &ServerError{Err: err, Status: statusBudgetNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetBudget}
	}

	return BudgetToProto(n.OrganizationResourceName(), m), nil
}

func (s *budgetServiceServer) ListBudgets(ctx context.Context, req *gen.ListBudgetsRequest) (*gen.ListBudgetsResponse, error) {
	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	c, err := svcfilter.ParseBudgetFilter(req.Filter)
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

	orderExprs, _ := order.Resolve(orderBy, repository.BudgetOrderFieldMapper)

	params := repository.ListBudgetsParams{
		OrganizationID: orgID,
		Page:           int(offset/int64(pageSize)) + 1,
		PageSize:       pageSize,
		Cond:           c,
		OrderBy:        orderExprs,
	}

	ms, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListBudgets}
	}

	resp := &gen.ListBudgetsResponse{TotalSize: total}
	for _, m := range ms {
		resp.Budgets = append(resp.Budgets, BudgetToProto(pn, m))
	}
	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}
	return resp, nil
}

func (s *budgetServiceServer) CreateBudget(ctx context.Context, req *gen.CreateBudgetRequest) (*gen.Budget, error) {
	if req.Budget == nil {
		return nil, &ServerError{Status: statusBudgetRequired}
	}

	var n gen.OrganizationResourceName

	if err := n.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionCreate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	b := req.Budget
	params := repository.CreateBudgetParams{
		OrganizationID:      orgID,
		DisplayName:         b.DisplayName,
		DisplayDescription:  b.DisplayDescription,
		IsPublished:         b.IsPublished,
		PublishActualValues: b.PublishActualValues,
		CustomID:            req.BudgetId,
	}
	if b.PeriodStart != nil {
		params.PeriodStart = protoDateToTime(b.PeriodStart)
	}

	if b.PeriodEnd != nil {
		params.PeriodEnd = protoDateToTime(b.PeriodEnd)
	}

	if b.PublishActualValuesUntil != nil {
		until := protoDateToTime(b.PublishActualValuesUntil)
		if until.Before(params.PeriodStart) || until.After(params.PeriodEnd) {
			return nil, &ServerError{Status: statusInvalidPublishActualValuesUntil}
		}
		params.PublishActualValuesUntil = &until
	}

	m, err := s.repo.Create(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrBudgetAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusBudgetAlreadyExists}
		}

		if errors.Is(err, repository.ErrOrganizationNotFound) {
			return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedCreateBudget}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.BudgetResourceName(m.CustomID).String(), orgID, m.ID,
	), AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return BudgetToProto(n, m), nil
}

func (s *budgetServiceServer) UpdateBudget(ctx context.Context, req *gen.UpdateBudgetRequest) (*gen.Budget, error) {
	if req.Budget == nil {
		return nil, &ServerError{Status: statusBudgetRequired}
	}

	var n gen.BudgetResourceName

	if err := n.UnmarshalString(req.Budget.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidBudgetName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInBudgetName}
	}

	// Use CustomID (n.Budget) instead of parsing as UUID
	m, err := s.repo.GetByCustomID(ctx, orgID, n.Budget)
	if err != nil {
		if errors.Is(err, repository.ErrBudgetNotFound) {
			return nil, &ServerError{Err: err, Status: statusBudgetNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetBudget}
	}

	before := *m

	until := sql.NullTime{}
	if req.Budget.PublishActualValuesUntil != nil {
		until.Time = protoDateToTime(req.Budget.PublishActualValuesUntil)
		until.Valid = true
		if until.Time.Before(m.PeriodStart) || until.Time.After(m.PeriodEnd) {
			return nil, &ServerError{Status: statusInvalidPublishActualValuesUntil}
		}
	}

	updateParams := repository.UpdateBudgetParams{
		DisplayName:              optional.From(req.Budget.DisplayName),
		DisplayDescription:       optional.From(req.Budget.DisplayDescription),
		IsPublished:              optional.From(req.Budget.IsPublished),
		PublishActualValues:      optional.From(req.Budget.PublishActualValues),
		PublishActualValuesUntil: optional.From(until),
	}

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateBudget}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateBudget}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return BudgetToProto(n.OrganizationResourceName(), m), nil
}

func (s *budgetServiceServer) CloseBudget(ctx context.Context, req *gen.CloseBudgetRequest) (*gen.Budget, error) {
	var n gen.BudgetResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidBudgetName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionClose, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInBudgetName}
	}

	// Use CustomID (n.Budget) instead of parsing as UUID
	m, err := s.repo.GetByCustomID(ctx, orgID, n.Budget)
	if err != nil {
		if errors.Is(err, repository.ErrBudgetNotFound) {
			return nil, &ServerError{Err: err, Status: statusBudgetNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetBudget}
	}

	before := *m

	updateParams := repository.UpdateBudgetParams{
		IsClosed: optional.From(true),
	}

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedCloseBudget}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedCloseBudget}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return BudgetToProto(n.OrganizationResourceName(), m), nil
}

func (s *budgetServiceServer) DeleteBudget(ctx context.Context, req *gen.DeleteBudgetRequest) (*emptypb.Empty, error) {
	var n gen.BudgetResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidBudgetName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInBudgetName}
	}

	// Use CustomID (n.Budget) to find the budget, then delete by actual ID
	m, err := s.repo.GetByCustomID(ctx, orgID, n.Budget)
	if err != nil {
		if errors.Is(err, repository.ErrBudgetNotFound) {
			return nil, &ServerError{Err: err, Status: statusBudgetNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetBudget}
	}

	if err := s.repo.Delete(ctx, m.ID); err != nil {
		if errors.Is(err, repository.ErrBudgetNotFound) {
			return nil, &ServerError{Err: err, Status: statusBudgetNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedDeleteBudget}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionDelete, m, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}
