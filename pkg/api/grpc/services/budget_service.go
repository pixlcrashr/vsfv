package services

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"go.einride.tech/aip/ordering"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"gorm.io/gorm"
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
	statusFailedReorderBudgets            = status.New(codes.Internal, "failed to reorder budgets")
	statusInvalidReorderBudgets           = status.New(codes.InvalidArgument, "budgets must contain every budget of the organization exactly once in its parent organization")
	statusInvalidPublishActualValuesUntil = status.New(codes.InvalidArgument, "publish_actual_values_until must lie within the budget period")
)

type budgetServiceServer struct {
	gen.UnimplementedBudgetServiceServer
	db       *gorm.DB
	enforcer *authz.Enforcer
}

func newBudgetServiceServer(db *gorm.DB, enforcer *authz.Enforcer) gen.BudgetServiceServer {
	return &budgetServiceServer{db: db, enforcer: enforcer}
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

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Budget, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Budget()

		// Use CustomID (n.Budget) instead of parsing as UUID
		m, err := repo.GetByCustomID(ctx, orgID, n.Budget)
		if err != nil {
			if errors.Is(err, repository.ErrBudgetNotFound) {
				return nil, &ServerError{Err: err, Status: statusBudgetNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedGetBudget}
		}

		return BudgetToProto(n.OrganizationResourceName(), m), nil
	})
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

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.ListBudgetsResponse, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Budget()

		ms, total, err := repo.List(ctx, params)
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
	})
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

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Budget, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Budget()
		audits := newAuditWriter(tx)

		m, err := repo.Create(ctx, params)
		if err != nil {
			if errors.Is(err, repository.ErrBudgetAlreadyExists) {
				return nil, &ServerError{Err: err, Status: statusBudgetAlreadyExists}
			}

			if errors.Is(err, repository.ErrOrganizationNotFound) {
				return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedCreateBudget}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			n.BudgetResourceName(m.CustomID).String(), orgID, m.ID,
		), AuditActionCreate, nil, m); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return BudgetToProto(n, m), nil
	})
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

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Budget, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Budget()
		audits := newAuditWriter(tx)

		// Use CustomID (n.Budget) instead of parsing as UUID
		m, err := repo.GetByCustomID(ctx, orgID, n.Budget)
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

		if err := repo.Update(ctx, m.ID, updateParams); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedUpdateBudget}
		}

		// Refresh the model after update
		m, err = repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedUpdateBudget}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			n.String(), orgID, m.ID,
		), AuditActionUpdate, &before, m); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return BudgetToProto(n.OrganizationResourceName(), m), nil
	})
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

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Budget, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Budget()
		audits := newAuditWriter(tx)

		// Use CustomID (n.Budget) instead of parsing as UUID
		m, err := repo.GetByCustomID(ctx, orgID, n.Budget)
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

		if err := repo.Update(ctx, m.ID, updateParams); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedCloseBudget}
		}

		// Refresh the model after update
		m, err = repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedCloseBudget}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			n.String(), orgID, m.ID,
		), AuditActionUpdate, &before, m); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return BudgetToProto(n.OrganizationResourceName(), m), nil
	})
}

func (s *budgetServiceServer) ReorderBudgets(ctx context.Context, req *gen.ReorderBudgetsRequest) (*emptypb.Empty, error) {
	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionUpdate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*emptypb.Empty, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Budget()
		audits := newAuditWriter(tx)

		ms, err := repo.ListAll(ctx, orgID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedReorderBudgets}
		}

		if len(req.Budgets) != len(ms) {
			return nil, &ServerError{Status: statusInvalidReorderBudgets}
		}

		byCustomID := make(map[string]*model.Budget, len(ms))
		for _, m := range ms {
			byCustomID[m.CustomID] = m
		}

		ordered := make([]*model.Budget, 0, len(req.Budgets))
		seen := make(map[string]struct{}, len(req.Budgets))
		for _, name := range req.Budgets {
			var n gen.BudgetResourceName

			if err := n.UnmarshalString(name); err != nil {
				return nil, &ServerError{Err: err, Status: statusInvalidBudgetName}
			}

			if n.Organization != pn.Organization {
				return nil, &ServerError{Status: statusInvalidReorderBudgets}
			}

			if _, ok := seen[n.Budget]; ok {
				return nil, &ServerError{Status: statusInvalidReorderBudgets}
			}
			seen[n.Budget] = struct{}{}

			m, ok := byCustomID[n.Budget]
			if !ok {
				return nil, &ServerError{Status: statusInvalidReorderBudgets}
			}
			ordered = append(ordered, m)
		}

		ids := make([]uuid.UUID, 0, len(ordered))
		for _, m := range ordered {
			ids = append(ids, m.ID)
		}

		if err := repo.Reorder(ctx, ids); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedReorderBudgets}
		}

		for i, m := range ordered {
			if m.Order == int32(i) {
				continue
			}

			before := *m
			after := *m
			after.Order = int32(i)

			if err := audits.Record(ctx, orgAuditSubject(
				pn.BudgetResourceName(m.CustomID).String(), orgID, m.ID,
			), AuditActionUpdate, &before, &after); err != nil {
				return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
			}
		}

		return &emptypb.Empty{}, nil
	})
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

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*emptypb.Empty, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Budget()
		audits := newAuditWriter(tx)

		// Use CustomID (n.Budget) to find the budget, then delete by actual ID
		m, err := repo.GetByCustomID(ctx, orgID, n.Budget)
		if err != nil {
			if errors.Is(err, repository.ErrBudgetNotFound) {
				return nil, &ServerError{Err: err, Status: statusBudgetNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedGetBudget}
		}

		if err := repo.Delete(ctx, m.ID); err != nil {
			if errors.Is(err, repository.ErrBudgetNotFound) {
				return nil, &ServerError{Err: err, Status: statusBudgetNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedDeleteBudget}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			n.String(), orgID, m.ID,
		), AuditActionDelete, m, nil); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return &emptypb.Empty{}, nil
	})
}
