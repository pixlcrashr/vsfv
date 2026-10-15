package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

var (
	statusInvalidActualAccountValueName           = status.New(codes.InvalidArgument, "invalid actual account value name")
	statusInvalidParentBudgetForActual            = status.New(codes.InvalidArgument, "invalid parent for actual account values")
	statusBudgetActualAccountValueNotFound        = status.New(codes.NotFound, "budget actual account value not found")
	statusFailedGetBudgetActualAccountValue       = status.New(codes.Internal, "failed to get budget actual account value")
	statusFailedListBudgetActualAccountValues     = status.New(codes.Internal, "failed to list budget actual account values")
	statusBatchGetNamesRequired                   = status.New(codes.InvalidArgument, "names are required for batch get")
	statusFailedBatchGetBudgetActualAccountValues = status.New(codes.Internal, "failed to batch get budget actual account values")
)

type budgetActualAccountValueServiceServer struct {
	gen.UnimplementedBudgetActualAccountValueServiceServer
	db       *gorm.DB
	enforcer *authz.Enforcer
}

func newBudgetActualAccountValueServiceServer(db *gorm.DB, enforcer *authz.Enforcer) gen.BudgetActualAccountValueServiceServer {
	return &budgetActualAccountValueServiceServer{db: db, enforcer: enforcer}
}

// applySignOrientation negates each value whose account effectively has sign
// inversion enabled (own or inherited invert_sign), so expense-oriented
// accounts are reported positive against positive plan targets. Values are
// flipped in place.
func applySignOrientation(ctx context.Context, accountRepo *repository.AccountRepository, orgID uuid.UUID, values []*repository.ActualAccountValue) error {
	ids := make([]uuid.UUID, 0, len(values))
	seen := make(map[uuid.UUID]struct{}, len(values))
	for _, v := range values {
		if _, ok := seen[v.AccountID]; ok {
			continue
		}
		seen[v.AccountID] = struct{}{}
		ids = append(ids, v.AccountID)
	}

	inverted, err := accountRepo.GetEffectiveInvertSigns(ctx, orgID, ids)
	if err != nil {
		return err
	}

	for _, v := range values {
		if inverted[v.AccountID] {
			v.Value.Neg(&v.Value)
		}
	}
	return nil
}

func (s *budgetActualAccountValueServiceServer) GetBudgetActualAccountValue(ctx context.Context, req *gen.GetBudgetActualAccountValueRequest) (*gen.BudgetActualAccountValue, error) {
	var n gen.BudgetActualAccountValueResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidActualAccountValueName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidActualAccountValueName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.BudgetActualAccountValue, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.BudgetActualAccountValue()
		budgetRepo := f.Budget()
		accountRepo := f.Account()

		budget, err := budgetRepo.GetByCustomID(ctx, orgID, n.Budget)
		if err != nil {
			if errors.Is(err, repository.ErrBudgetNotFound) {
				return nil, &ServerError{Err: err, Status: statusBudgetNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetBudgetActualAccountValue}
		}

		m, err := repo.GetByBudgetAndAccount(ctx, orgID, budget.PeriodStart, budget.PeriodEnd, n.Account)
		if err != nil {
			if errors.Is(err, repository.ErrBudgetActualAccountValueNotFound) {
				return nil, &ServerError{Err: err, Status: statusBudgetActualAccountValueNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetBudgetActualAccountValue}
		}

		if err := applySignOrientation(ctx, accountRepo, orgID, []*repository.ActualAccountValue{m}); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetBudgetActualAccountValue}
		}

		return BudgetActualAccountValueToProto(n.BudgetResourceName(), m), nil
	})
}

func (s *budgetActualAccountValueServiceServer) ListBudgetActualAccountValues(ctx context.Context, req *gen.ListBudgetActualAccountValuesRequest) (*gen.ListBudgetActualAccountValuesResponse, error) {
	var budgetRN gen.BudgetResourceName

	if err := budgetRN.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetForActual}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionRead, authz.OrgDomain(budgetRN.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(budgetRN.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetForActual}
	}

	c, err := svcfilter.ParseBudgetActualAccountValueFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	filters, accountCond, err := svcfilter.ExtractBudgetActualAccountValueFilters(c)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.ListBudgetActualAccountValuesResponse, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.BudgetActualAccountValue()
		budgetRepo := f.Budget()
		accountRepo := f.Account()

		// The budget segment may be a wildcard ("-") to query across all budgets in
		// the organization. Otherwise the query is scoped to that single budget.
		var budgetCustomIDs []string
		if budgetRN.Budget != "-" {
			// A named budget must exist so an unknown one yields NotFound instead
			// of an empty result.
			if _, err := budgetRepo.GetByCustomID(ctx, orgID, budgetRN.Budget); err != nil {
				if errors.Is(err, repository.ErrBudgetNotFound) {
					return nil, &ServerError{Err: err, Status: statusBudgetNotFound}
				}
				return nil, &ServerError{Err: err, Status: statusFailedListBudgetActualAccountValues}
			}
			budgetCustomIDs = []string{budgetRN.Budget}
		} else if len(filters.Budgets) > 0 {
			// The "budget" filter carries full resource names while the query
			// below matches on the budget custom ID, so keep only the ID
			// segments. Budgets of other organizations are excluded by the
			// query's organization join.
			budgetCustomIDs = make([]string, 0, len(filters.Budgets))
			for _, name := range filters.Budgets {
				var rn gen.BudgetResourceName
				if err := rn.UnmarshalString(name); err != nil {
					return nil, &ServerError{Err: err, Status: statusInvalidFilter}
				}
				budgetCustomIDs = append(budgetCustomIDs, rn.Budget)
			}
		}

		allValues, err := repo.ListByBudgets(ctx, orgID, budgetCustomIDs, filters.DateFrom, filters.DateTo)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListBudgetActualAccountValues}
		}

		filtered := make([]*repository.ActualAccountValue, 0, len(allValues))
		for _, v := range allValues {
			if accountCond != nil && !evalActualAccountValueCond(accountCond, v) {
				continue
			}
			filtered = append(filtered, v)
		}

		if err := applySignOrientation(ctx, accountRepo, orgID, filtered); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListBudgetActualAccountValues}
		}

		total := int64(len(filtered))

		offset, err := pagetoken.Decode(req.PageToken)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidPageToken}
		}

		pageSize := normalizePageSizeMax(req.PageSize, 500)
		start := int(offset)
		if start > len(filtered) {
			start = len(filtered)
		}
		end := start + pageSize
		if end > len(filtered) {
			end = len(filtered)
		}
		page := filtered[start:end]

		resp := &gen.ListBudgetActualAccountValuesResponse{TotalSize: total}
		for _, m := range page {
			respBudgetRN := budgetRN.OrganizationResourceName().BudgetResourceName(m.BudgetCustomID)
			resp.ActualAccountValues = append(resp.ActualAccountValues, BudgetActualAccountValueToProto(respBudgetRN, m))
		}

		nextOffset := offset + int64(len(page))
		if nextOffset < total {
			resp.NextPageToken = pagetoken.Encode(nextOffset)
		}

		return resp, nil
	})
}

func (s *budgetActualAccountValueServiceServer) BatchGetBudgetActualAccountValues(ctx context.Context, req *gen.BatchGetBudgetActualAccountValuesRequest) (*gen.BatchGetBudgetActualAccountValuesResponse, error) {
	var orgRN gen.OrganizationResourceName

	if err := orgRN.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetForActual}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionRead, authz.OrgDomain(orgRN.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(orgRN.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetForActual}
	}

	if len(req.Names) == 0 {
		return nil, &ServerError{Status: statusBatchGetNamesRequired}
	}

	budgetCustomIDs := make(map[string]struct{})
	accountCustomIDs := make(map[string]struct{})
	for _, name := range req.Names {
		var n gen.BudgetActualAccountValueResourceName
		if err := n.UnmarshalString(name); err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidActualAccountValueName}
		}
		if n.Organization != orgRN.Organization {
			return nil, &ServerError{Status: statusInvalidActualAccountValueName}
		}
		budgetCustomIDs[n.Budget] = struct{}{}
		accountCustomIDs[n.Account] = struct{}{}
	}

	budgetIDs := make([]string, 0, len(budgetCustomIDs))
	for id := range budgetCustomIDs {
		budgetIDs = append(budgetIDs, id)
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.BatchGetBudgetActualAccountValuesResponse, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.BudgetActualAccountValue()
		accountRepo := f.Account()

		allValues, err := repo.ListByBudgets(ctx, orgID, budgetIDs, nil, nil)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedBatchGetBudgetActualAccountValues}
		}

		resultByKey := make(map[string]*repository.ActualAccountValue, len(allValues))
		for _, v := range allValues {
			if _, ok := accountCustomIDs[v.AccountCustomID]; !ok {
				continue
			}
			key := fmt.Sprintf("%s/%s", v.BudgetCustomID, v.AccountCustomID)
			resultByKey[key] = v
		}

		values := make([]*repository.ActualAccountValue, 0, len(resultByKey))
		for _, v := range resultByKey {
			values = append(values, v)
		}
		if err := applySignOrientation(ctx, accountRepo, orgID, values); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedBatchGetBudgetActualAccountValues}
		}

		resp := &gen.BatchGetBudgetActualAccountValuesResponse{}
		for _, name := range req.Names {
			var n gen.BudgetActualAccountValueResourceName
			if err := n.UnmarshalString(name); err != nil {
				continue
			}
			key := fmt.Sprintf("%s/%s", n.Budget, n.Account)
			if v, ok := resultByKey[key]; ok {
				budgetRN := orgRN.BudgetResourceName(v.BudgetCustomID)
				resp.ActualAccountValues = append(resp.ActualAccountValues, BudgetActualAccountValueToProto(budgetRN, v))
			}
		}

		return resp, nil
	})
}

func evalActualAccountValueCond(c cond.Cond, v *repository.ActualAccountValue) bool {
	if c == nil || c.IsEmpty() {
		return true
	}
	switch cc := c.(type) {
	case cond.FieldCond:
		if cc.Field == "account" {
			s, ok := cc.Value.(string)
			if !ok {
				return false
			}
			// Extract the account custom ID from the resource name
			// (last path segment of "organizations/{org}/accounts/{account}").
			accountCustomID := s
			if idx := strings.LastIndex(s, "/"); idx >= 0 {
				accountCustomID = s[idx+1:]
			}
			switch cc.Op {
			case cond.OpEq:
				return v.AccountCustomID == accountCustomID
			case cond.OpNe:
				return v.AccountCustomID != accountCustomID
			}
		}
		return false
	case cond.AndCond:
		for _, sub := range cc.Conds {
			if !evalActualAccountValueCond(sub, v) {
				return false
			}
		}
		return true
	case cond.OrCond:
		for _, sub := range cc.Conds {
			if evalActualAccountValueCond(sub, v) {
				return true
			}
		}
		return false
	case cond.NotCond:
		return !evalActualAccountValueCond(cc.Inner, v)
	}
	return true
}
