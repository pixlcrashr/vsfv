package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"go.einride.tech/aip/ordering"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

var (
	statusInvalidBudgetRevisionAccountValueName = status.New(codes.InvalidArgument, "invalid budget revision account value name")
	statusInvalidParentRevisionName             = status.New(codes.InvalidArgument, "invalid parent revision name")
	statusBudgetRevisionAccountValueNotFound    = status.New(codes.NotFound, "budget revision account value not found")
	statusFailedGetBudgetRevisionAccountValue   = status.New(codes.Internal, "failed to get budget revision account value")
	statusFailedListBudgetRevisionAccountValues = status.New(codes.Internal, "failed to list budget revision account values")
)

// Wildcard parent / filter validation errors surfaced as invalid arguments.
var (
	errInvalidWildcardParent                = fmt.Errorf(`wildcard parent must be "organizations/{organization}/budgets/-/revisions/-"; mixed forms and "*" are not supported`)
	errRevisionFilterWithConcreteParent     = fmt.Errorf("revision filter requires the wildcard parent organizations/{organization}/budgets/-/revisions/-")
	errWildcardParentRequiresRevisionFilter = fmt.Errorf("wildcard parent requires at least one revision filter, e.g. revision=%q", "organizations/{organization}/budgets/{budget}/revisions/{revision}")
)

type budgetRevisionAccountValueServiceServer struct {
	gen.UnimplementedBudgetRevisionAccountValueServiceServer
	db       *gorm.DB
	enforcer *authz.Enforcer
}

func newBudgetRevisionAccountValueServiceServer(db *gorm.DB, enforcer *authz.Enforcer) gen.BudgetRevisionAccountValueServiceServer {
	return &budgetRevisionAccountValueServiceServer{db: db, enforcer: enforcer}
}

func (s *budgetRevisionAccountValueServiceServer) GetBudgetRevisionAccountValue(ctx context.Context, req *gen.GetBudgetRevisionAccountValueRequest) (*gen.BudgetRevisionAccountValue, error) {
	var n gen.BudgetRevisionAccountValueResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidBudgetRevisionAccountValueName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.AccountValue)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidBudgetRevisionAccountValueName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.BudgetRevisionAccountValue, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.BudgetRevisionAccountValue()
		accountRepo := f.Account()

		m, err := repo.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, repository.ErrBudgetRevisionAccountValueNotFound) {
				return nil, &ServerError{Err: err, Status: statusBudgetRevisionAccountValueNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedGetBudgetRevisionAccountValue}
		}

		account, _ := accountRepo.GetByID(ctx, m.AccountID)

		return BudgetRevisionAccountValueToProto(n.BudgetRevisionResourceName(), m, account), nil
	})
}

func (s *budgetRevisionAccountValueServiceServer) ListBudgetRevisionAccountValues(ctx context.Context, req *gen.ListBudgetRevisionAccountValuesRequest) (*gen.ListBudgetRevisionAccountValuesResponse, error) {
	var pn gen.BudgetRevisionResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentRevisionName}
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentRevisionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	// Strict parent validation: the dash "-" is the only wildcard marker and
	// it is accepted for the budget and revision segments together only. A
	// literal "*" or any other non-UUID segment is never treated as a
	// wildcard.
	multiRevision := pn.Budget == "-" && pn.Revision == "-"
	var singleRevisionID uuid.UUID
	if !multiRevision {
		if pn.Budget == "-" || pn.Revision == "-" {
			return nil, &ServerError{Err: errInvalidWildcardParent, Status: statusInvalidParentRevisionName}
		}
		singleRevisionID, err = uuid.Parse(pn.Revision)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidParentRevisionName}
		}
	}

	c, err := svcfilter.ParseBudgetRevisionAccountValueFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	// Resolve "revision" resource names in the filter to revision models. In
	// multi-revision mode the filter selects the revisions to fetch; with a
	// concrete parent it is not accepted.
	filters, c, err := svcfilter.ExtractBudgetRevisionAccountValueFilters(c)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}
	if !multiRevision && len(filters.Revisions) > 0 {
		return nil, &ServerError{Err: errRevisionFilterWithConcreteParent, Status: statusInvalidFilter}
	}
	if multiRevision && len(filters.Revisions) == 0 {
		return nil, &ServerError{Err: errWildcardParentRequiresRevisionFilter, Status: statusInvalidFilter}
	}

	// Resolve "account" resource names in the filter to account UUIDs.
	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.ListBudgetRevisionAccountValuesResponse, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.BudgetRevisionAccountValue()
		accountRepo := f.Account()
		revisionRepo := f.BudgetRevision()
		budgetRepo := f.Budget()

		c = cond.Transform(c, func(field string, value interface{}) (string, interface{}, bool) {
			if field != "account" {
				return field, value, true
			}
			accountName, ok := value.(string)
			if !ok {
				return field, value, true
			}
			var accountRN gen.AccountResourceName
			if err := accountRN.UnmarshalString(accountName); err != nil {
				return field, value, false
			}
			a, err := accountRepo.GetByCustomID(ctx, orgID, accountRN.Account)
			if err != nil {
				return field, value, false
			}
			return "account", a.ID.String(), true
		})

		// Revisions to query and the name-building info per revision ID.
		revisionIDs := []uuid.UUID{singleRevisionID}
		revisionByID := make(map[uuid.UUID]*model.BudgetRevision)
		budgetByID := make(map[uuid.UUID]*model.Budget)
		if multiRevision {
			revisionIDs = make([]uuid.UUID, 0, len(filters.Revisions))
			for _, name := range filters.Revisions {
				var rn gen.BudgetRevisionResourceName
				if err := rn.UnmarshalString(name); err != nil {
					return nil, &ServerError{Err: err, Status: statusInvalidFilter}
				}
				id, err := uuid.Parse(rn.Revision)
				if err != nil {
					return nil, &ServerError{Err: err, Status: statusInvalidFilter}
				}
				if _, seen := revisionByID[id]; seen {
					continue
				}
				rev, err := revisionRepo.GetByID(ctx, id)
				if err != nil {
					if errors.Is(err, repository.ErrBudgetRevisionNotFound) {
						return nil, &ServerError{Err: fmt.Errorf("revision %q in filter: %w", name, err), Status: statusInvalidFilter}
					}
					return nil, &ServerError{Err: err, Status: statusFailedListBudgetRevisionAccountValues}
				}
				if rev.OrganizationID != orgID {
					return nil, &ServerError{Err: fmt.Errorf("revision %q does not belong to organization %s", name, pn.Organization), Status: statusInvalidFilter}
				}
				budget, err := budgetRepo.GetByID(ctx, rev.BudgetID)
				if err != nil {
					if errors.Is(err, repository.ErrBudgetNotFound) {
						return nil, &ServerError{Err: fmt.Errorf("budget of revision %q: %w", name, err), Status: statusInvalidFilter}
					}
					return nil, &ServerError{Err: err, Status: statusFailedListBudgetRevisionAccountValues}
				}
				revisionIDs = append(revisionIDs, id)
				revisionByID[id] = rev
				budgetByID[rev.BudgetID] = budget
			}
		}

		offset, err := pagetoken.Decode(req.PageToken)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidPageToken}
		}

		pageSize := normalizePageSizeMax(req.PageSize, 500)

		orderBy, err := ordering.ParseOrderBy(req)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidOrderBy}
		}

		orderExprs, _ := order.Resolve(orderBy, order.FieldMapper{
			"account":    "account_id",
			"value":      "value",
			"createTime": "created_at",
		})

		params := repository.ListBudgetRevisionAccountValuesParams{
			BudgetRevisionID:  singleRevisionID,
			BudgetRevisionIDs: revisionIDs,
			Page:              int(offset/int64(pageSize)) + 1,
			PageSize:          pageSize,
			Cond:              c,
			OrderBy:           orderExprs,
		}
		if multiRevision {
			params.BudgetRevisionID = uuid.Nil
		}

		ms, total, err := repo.List(ctx, params)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListBudgetRevisionAccountValues}
		}

		// Batch-fetch account models for the response.
		accountIDs := make([]uuid.UUID, 0, len(ms))
		for _, m := range ms {
			accountIDs = append(accountIDs, m.AccountID)
		}
		accountMap := s.fetchAccountsByIDs(ctx, accountRepo, accountIDs)

		// Name of the parent used for resource names: the concrete parent, or
		// per-row revision names in multi-revision mode.
		revisionRN := func(m *model.BudgetRevisionAccountValue) gen.BudgetRevisionResourceName {
			if multiRevision {
				rev := revisionByID[m.BudgetRevisionID]
				budget := budgetByID[rev.BudgetID]
				return gen.BudgetRevisionResourceName{
					Organization: pn.Organization,
					Budget:       budget.CustomID,
					Revision:     rev.CustomID,
				}
			}
			return pn
		}

		resp := &gen.ListBudgetRevisionAccountValuesResponse{TotalSize: total}
		for _, m := range ms {
			resp.AccountValues = append(resp.AccountValues, BudgetRevisionAccountValueToProto(revisionRN(m), m, accountMap[m.AccountID]))
		}

		nextOffset := offset + int64(len(ms))
		if nextOffset < total {
			resp.NextPageToken = pagetoken.Encode(nextOffset)
		}

		return resp, nil
	})
}

// fetchAccountsByIDs fetches multiple accounts by ID and returns a map keyed by account ID.
// Accounts that cannot be found are omitted from the map.
func (s *budgetRevisionAccountValueServiceServer) fetchAccountsByIDs(ctx context.Context, accountRepo *repository.AccountRepository, ids []uuid.UUID) map[uuid.UUID]*model.Account {
	result := make(map[uuid.UUID]*model.Account, len(ids))
	for _, id := range ids {
		if a, err := accountRepo.GetByID(ctx, id); err == nil {
			result[id] = a
		}
	}
	return result
}
