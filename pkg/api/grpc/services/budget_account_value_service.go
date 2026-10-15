package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/cockroachdb/apd/v3"
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
	"github.com/theater-improrama/go-utils/optional"
	"go.einride.tech/aip/ordering"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"gorm.io/gorm"
)

var (
	statusAccountValueRequired                 = status.New(codes.InvalidArgument, "account_value is required")
	statusInvalidAccountValueName              = status.New(codes.InvalidArgument, "invalid account value name")
	statusInvalidParentBudgetName              = status.New(codes.InvalidArgument, "invalid parent budget name")
	statusInvalidValue                         = status.New(codes.InvalidArgument, "invalid value")
	statusBudgetAccountValueNotFound           = status.New(codes.NotFound, "budget account value not found")
	statusBudgetAccountValueAlreadyExists      = status.New(codes.AlreadyExists, "budget account value with this ID already exists")
	statusFailedGetBudgetAccountValue          = status.New(codes.Internal, "failed to get budget account value")
	statusFailedListBudgetAccountValues        = status.New(codes.Internal, "failed to list budget account values")
	statusFailedCreateBudgetAccountValue       = status.New(codes.Internal, "failed to create budget account value")
	statusFailedUpdateBudgetAccountValue       = status.New(codes.Internal, "failed to update budget account value")
	statusFailedDeleteBudgetAccountValue       = status.New(codes.Internal, "failed to delete budget account value")
	statusFailedBatchUpdateBudgetAccountValues = status.New(codes.Internal, "failed to batch update budget account values")
	statusAccountValueNameMismatch             = status.New(codes.InvalidArgument, "account value name does not match batch parent")
	statusAccountValueRequestRequired          = status.New(codes.InvalidArgument, "account_value is required in each request")
	statusInvalidAccountValueInBatch           = status.New(codes.InvalidArgument, "invalid account in batch request")
	statusInvalidValueInBatch                  = status.New(codes.InvalidArgument, "invalid value in batch request")
)

// Wildcard parent / filter validation errors surfaced as invalid arguments.
var (
	errBudgetFilterWithConcreteParent = fmt.Errorf("budget filter requires the wildcard parent organizations/{organization}/budgets/-")
)

type budgetAccountValueServiceServer struct {
	gen.UnimplementedBudgetAccountValueServiceServer
	db       *gorm.DB
	enforcer *authz.Enforcer
}

func newBudgetAccountValueServiceServer(db *gorm.DB, enforcer *authz.Enforcer) gen.BudgetAccountValueServiceServer {
	return &budgetAccountValueServiceServer{db: db, enforcer: enforcer}
}

// resolveAccount parses an account resource name and resolves it to a UUID via the account repo.
func (s *budgetAccountValueServiceServer) resolveAccount(ctx context.Context, accountRepo *repository.AccountRepository, orgID uuid.UUID, accountName string) (uuid.UUID, *model.Account, error) {
	var accountRN gen.AccountResourceName
	if err := accountRN.UnmarshalString(accountName); err != nil {
		return uuid.Nil, nil, err
	}
	a, err := accountRepo.GetByCustomID(ctx, orgID, accountRN.Account)
	if err != nil {
		return uuid.Nil, nil, err
	}
	return a.ID, a, nil
}

func (s *budgetAccountValueServiceServer) CreateBudgetAccountValue(ctx context.Context, req *gen.CreateBudgetAccountValueRequest) (*gen.BudgetAccountValue, error) {
	if req.AccountValue == nil {
		return nil, &ServerError{Status: statusAccountValueRequired}
	}

	var pn gen.BudgetResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionCreate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetName}
	}

	budgetID, err := uuid.Parse(pn.Budget)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.BudgetAccountValue, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.BudgetAccountValue()
		accountRepo := f.Account()
		audits := newAuditWriter(tx)

		accountID, account, err := s.resolveAccount(ctx, accountRepo, orgID, req.AccountValue.Account)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidAccountID}
		}

		var val apd.Decimal

		if req.AccountValue.Value != nil {
			if _, _, err := val.SetString(req.AccountValue.Value.Value); err != nil {
				return nil, &ServerError{Err: err, Status: statusInvalidValue}
			}
		}

		m, err := repo.Create(ctx, repository.CreateBudgetAccountValueParams{
			OrganizationID: orgID,
			BudgetID:       budgetID,
			AccountID:      accountID,
			Value:          val,
			CustomID:       req.BudgetAccountValueId,
		})
		if err != nil {
			if errors.Is(err, repository.ErrBudgetAccountValueAlreadyExists) {
				return nil, &ServerError{Err: err, Status: statusBudgetAccountValueAlreadyExists}
			}

			if errors.Is(err, repository.ErrBudgetNotFound) {
				return nil, &ServerError{Err: err, Status: statusBudgetNotFound}
			}

			if errors.Is(err, repository.ErrAccountNotFound) {
				return nil, &ServerError{Err: err, Status: statusAccountNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedCreateBudgetAccountValue}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			pn.BudgetAccountValueResourceName(m.CustomID).String(), orgID, m.ID,
		), AuditActionCreate, nil, m); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return BudgetAccountValueToProto(pn, m, account), nil
	})
}

func (s *budgetAccountValueServiceServer) GetBudgetAccountValue(ctx context.Context, req *gen.GetBudgetAccountValueRequest) (*gen.BudgetAccountValue, error) {
	var n gen.BudgetAccountValueResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountValueName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.AccountValue)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountValueName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.BudgetAccountValue, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.BudgetAccountValue()
		accountRepo := f.Account()

		m, err := repo.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, repository.ErrBudgetAccountValueNotFound) {
				return nil, &ServerError{Err: err, Status: statusBudgetAccountValueNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedGetBudgetAccountValue}
		}

		account, _ := accountRepo.GetByID(ctx, m.AccountID)

		return BudgetAccountValueToProto(n.BudgetResourceName(), m, account), nil
	})
}

func (s *budgetAccountValueServiceServer) ListBudgetAccountValues(ctx context.Context, req *gen.ListBudgetAccountValuesRequest) (*gen.ListBudgetAccountValuesResponse, error) {
	var pn gen.BudgetResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetName}
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	// Strict parent validation: the dash "-" is the only wildcard marker and
	// it is accepted for the budget segment only. A literal "*" or any other
	// non-UUID segment is never treated as a wildcard.
	orgWide := pn.Budget == "-"
	var budgetID uuid.UUID
	if !orgWide {
		budgetID, err = uuid.Parse(pn.Budget)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetName}
		}
	}

	c, err := svcfilter.ParseBudgetAccountValueFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	// The "budget" filter selects the budgets of a wildcard request; with a
	// concrete parent it is not accepted.
	filters, c, err := svcfilter.ExtractBudgetAccountValueFilters(c)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}
	if !orgWide && len(filters.Budgets) > 0 {
		return nil, &ServerError{Err: errBudgetFilterWithConcreteParent, Status: statusInvalidFilter}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.ListBudgetAccountValuesResponse, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.BudgetAccountValue()
		accountRepo := f.Account()
		budgetRepo := f.Budget()

		// Resolve "account" resource names in the filter to account UUIDs.
		c = cond.Transform(c, func(field string, value interface{}) (string, interface{}, bool) {
			if field != "account" {
				return field, value, true
			}
			accountName, ok := value.(string)
			if !ok {
				return field, value, true
			}
			accountID, _, err := s.resolveAccount(ctx, accountRepo, orgID, accountName)
			if err != nil {
				return field, value, false
			}
			return "account", accountID.String(), true
		})

		// Resolve "budget" resource names of a wildcard request to budget
		// UUIDs within the organization.
		budgetIDs := make([]uuid.UUID, 0, len(filters.Budgets))
		for _, name := range filters.Budgets {
			var rn gen.BudgetResourceName
			if err := rn.UnmarshalString(name); err != nil {
				return nil, &ServerError{Err: err, Status: statusInvalidFilter}
			}
			id, err := uuid.Parse(rn.Budget)
			if err != nil {
				return nil, &ServerError{Err: err, Status: statusInvalidFilter}
			}
			budget, err := budgetRepo.GetByID(ctx, id)
			if err != nil {
				if errors.Is(err, repository.ErrBudgetNotFound) {
					return nil, &ServerError{Err: fmt.Errorf("budget %q in filter: %w", name, err), Status: statusInvalidFilter}
				}
				return nil, &ServerError{Err: err, Status: statusFailedListBudgetAccountValues}
			}
			if budget.OrganizationID != orgID {
				return nil, &ServerError{Err: fmt.Errorf("budget %q does not belong to organization %s", name, pn.Organization), Status: statusInvalidFilter}
			}
			budgetIDs = append(budgetIDs, id)
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

		orderExprs, _ := order.Resolve(orderBy, repository.BudgetAccountValueOrderFieldMapper)

		params := repository.ListBudgetAccountValuesParams{
			OrganizationID: orgID,
			BudgetID:       budgetID,
			BudgetIDs:      budgetIDs,
			Cond:           c,
			Page:           int(offset/int64(pageSize)) + 1,
			PageSize:       pageSize,
			OrderBy:        orderExprs,
		}

		ms, total, err := repo.List(ctx, params)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListBudgetAccountValues}
		}

		// Batch-fetch account models for the response.
		accountIDs := make([]uuid.UUID, 0, len(ms))
		for _, m := range ms {
			accountIDs = append(accountIDs, m.AccountID)
		}
		accountMap := s.fetchAccountsByIDs(ctx, accountRepo, accountIDs)

		// Resource names carry the real budget segment: the concrete parent,
		// or the owning budget's name in wildcard mode.
		budgetCustomIDs := make(map[uuid.UUID]string)
		budgetRN := func(m *model.BudgetAccountValue) (gen.BudgetResourceName, error) {
			if !orgWide {
				return pn, nil
			}
			if customID, ok := budgetCustomIDs[m.BudgetID]; ok {
				return gen.BudgetResourceName{Organization: pn.Organization, Budget: customID}, nil
			}
			budget, err := budgetRepo.GetByID(ctx, m.BudgetID)
			if err != nil {
				if errors.Is(err, repository.ErrBudgetNotFound) {
					return gen.BudgetResourceName{}, fmt.Errorf("budget of account value %s: %w", m.ID, err)
				}
				return gen.BudgetResourceName{}, fmt.Errorf("get budget of account value %s: %w", m.ID, err)
			}
			budgetCustomIDs[m.BudgetID] = budget.CustomID
			return gen.BudgetResourceName{Organization: pn.Organization, Budget: budget.CustomID}, nil
		}

		resp := &gen.ListBudgetAccountValuesResponse{TotalSize: total}
		for _, m := range ms {
			rn, err := budgetRN(m)
			if err != nil {
				return nil, &ServerError{Err: err, Status: statusFailedListBudgetAccountValues}
			}
			resp.AccountValues = append(resp.AccountValues, BudgetAccountValueToProto(rn, m, accountMap[m.AccountID]))
		}

		nextOffset := offset + int64(len(ms))
		if nextOffset < total {
			resp.NextPageToken = pagetoken.Encode(nextOffset)
		}

		return resp, nil
	})
}

func (s *budgetAccountValueServiceServer) UpdateBudgetAccountValue(ctx context.Context, req *gen.UpdateBudgetAccountValueRequest) (*gen.BudgetAccountValue, error) {
	if req.AccountValue == nil {
		return nil, &ServerError{Status: statusAccountValueRequired}
	}

	var n gen.BudgetAccountValueResourceName

	if err := n.UnmarshalString(req.AccountValue.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountValueName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.AccountValue)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountValueName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.BudgetAccountValue, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.BudgetAccountValue()
		accountRepo := f.Account()
		audits := newAuditWriter(tx)

		m, err := repo.GetByID(ctx, id)
		if err != nil {
			if !errors.Is(err, repository.ErrBudgetAccountValueNotFound) {
				return nil, &ServerError{Err: err, Status: statusFailedGetBudgetAccountValue}
			}

			if !req.AllowMissing {
				return nil, &ServerError{Err: err, Status: statusBudgetAccountValueNotFound}
			}

			// allow_missing: create the resource
			orgID, err := uuid.Parse(n.Organization)
			if err != nil {
				return nil, &ServerError{Err: err, Status: statusInvalidAccountValueName}
			}

			budgetID, err := uuid.Parse(n.Budget)
			if err != nil {
				return nil, &ServerError{Err: err, Status: statusInvalidAccountValueName}
			}

			accountID, account, err := s.resolveAccount(ctx, accountRepo, orgID, req.AccountValue.Account)
			if err != nil {
				return nil, &ServerError{Err: err, Status: statusInvalidAccountID}
			}

			var val apd.Decimal

			if req.AccountValue.Value != nil {
				if _, _, err := val.SetString(req.AccountValue.Value.Value); err != nil {
					return nil, &ServerError{Err: err, Status: statusInvalidValue}
				}
			}

			newM, err := repo.Create(ctx, repository.CreateBudgetAccountValueParams{
				OrganizationID: orgID,
				BudgetID:       budgetID,
				AccountID:      accountID,
				Value:          val,
			})
			if err != nil {
				return nil, &ServerError{Err: err, Status: statusFailedCreateBudgetAccountValue}
			}

			if err := audits.Record(ctx, orgAuditSubject(
				n.BudgetResourceName().BudgetAccountValueResourceName(newM.CustomID).String(), orgID, newM.ID,
			), AuditActionCreate, nil, newM); err != nil {
				return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
			}

			return BudgetAccountValueToProto(n.BudgetResourceName(), newM, account), nil
		}

		before := *m

		updateParams := repository.UpdateBudgetAccountValueParams{}
		if req.AccountValue.Value != nil {
			var val apd.Decimal
			if _, _, err := val.SetString(req.AccountValue.Value.Value); err != nil {
				return nil, &ServerError{Err: err, Status: statusInvalidValue}
			}
			updateParams.Value = optional.From(val)
		}

		if err := repo.Update(ctx, m.ID, updateParams); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedUpdateBudgetAccountValue}
		}

		// Refresh the model after update
		m, err = repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedUpdateBudgetAccountValue}
		}

		orgID, err := uuid.Parse(n.Organization)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidAccountValueName}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			n.String(), orgID, m.ID,
		), AuditActionUpdate, &before, m); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		account, _ := accountRepo.GetByID(ctx, m.AccountID)

		return BudgetAccountValueToProto(n.BudgetResourceName(), m, account), nil
	})
}

func (s *budgetAccountValueServiceServer) BatchUpdateBudgetAccountValues(ctx context.Context, req *gen.BatchUpdateBudgetAccountValuesRequest) (*gen.BatchUpdateBudgetAccountValuesResponse, error) {
	var pn gen.BudgetResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionUpdate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetName}
	}

	budgetID, err := uuid.Parse(pn.Budget)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentBudgetName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.BatchUpdateBudgetAccountValuesResponse, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.BudgetAccountValue()
		accountRepo := f.Account()
		audits := newAuditWriter(tx)

		entries := make([]repository.UpsertEntry, 0, len(req.Requests))
		accountIDs := make([]uuid.UUID, 0, len(req.Requests))
		for _, r := range req.Requests {
			if r.AccountValue == nil {
				return nil, &ServerError{Status: statusAccountValueRequestRequired}
			}

			// Validate that any set resource name is consistent with the batch parent.
			if r.AccountValue.Name != "" {
				var n gen.BudgetAccountValueResourceName

				if err := n.UnmarshalString(r.AccountValue.Name); err != nil {
					return nil, &ServerError{Err: err, Status: statusInvalidAccountValueName}
				}

				if n.Organization != pn.Organization || n.Budget != pn.Budget {
					return nil, &ServerError{Status: statusAccountValueNameMismatch}
				}
			}

			accountID, _, err := s.resolveAccount(ctx, accountRepo, orgID, r.AccountValue.Account)
			if err != nil {
				return nil, &ServerError{Err: err, Status: statusInvalidAccountValueInBatch}
			}

			var val apd.Decimal

			if r.AccountValue.Value != nil {
				if _, _, err := val.SetString(r.AccountValue.Value.Value); err != nil {
					return nil, &ServerError{Err: err, Status: statusInvalidValueInBatch}
				}
			}

			entries = append(entries, repository.UpsertEntry{AccountID: accountID, Value: val})
			accountIDs = append(accountIDs, accountID)
		}

		// Capture the before-state so the upsert results can be audited as
		// either creations or updates.
		beforeRows, err := repo.GetByBudgetAndAccountIDs(ctx, orgID, budgetID, accountIDs)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedBatchUpdateBudgetAccountValues}
		}
		beforeByAccountID := make(map[uuid.UUID]*model.BudgetAccountValue, len(beforeRows))
		for _, b := range beforeRows {
			beforeByAccountID[b.AccountID] = b
		}

		ms, err := repo.BatchUpsert(ctx, orgID, budgetID, entries)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedBatchUpdateBudgetAccountValues}
		}

		// Audit each upserted value: one entry per affected resource.
		for _, m := range ms {
			before, existed := beforeByAccountID[m.AccountID]
			action := AuditActionCreate
			var beforeAny any
			if existed {
				action, beforeAny = AuditActionUpdate, before
			}
			if err := audits.Record(ctx, orgAuditSubject(
				pn.BudgetAccountValueResourceName(m.CustomID).String(), orgID, m.ID,
			), action, beforeAny, m); err != nil {
				return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
			}
		}

		// Batch-fetch account models for the response.
		// Use the account IDs from the upsert entries (same order as ms).
		accountMap := s.fetchAccountsByIDs(ctx, accountRepo, accountIDs)

		resp := &gen.BatchUpdateBudgetAccountValuesResponse{}
		for _, m := range ms {
			resp.AccountValues = append(resp.AccountValues, BudgetAccountValueToProto(pn, m, accountMap[m.AccountID]))
		}

		return resp, nil
	})
}

func (s *budgetAccountValueServiceServer) DeleteBudgetAccountValue(ctx context.Context, req *gen.DeleteBudgetAccountValueRequest) (*emptypb.Empty, error) {
	var n gen.BudgetAccountValueResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountValueName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceBudgets, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.AccountValue)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountValueName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*emptypb.Empty, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.BudgetAccountValue()
		audits := newAuditWriter(tx)

		m, err := repo.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, repository.ErrBudgetAccountValueNotFound) {
				return nil, &ServerError{Err: err, Status: statusBudgetAccountValueNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedGetBudgetAccountValue}
		}

		if err := repo.Delete(ctx, id); err != nil {
			if errors.Is(err, repository.ErrBudgetAccountValueNotFound) {
				return nil, &ServerError{Err: err, Status: statusBudgetAccountValueNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedDeleteBudgetAccountValue}
		}

		orgID, err := uuid.Parse(n.Organization)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidAccountValueName}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			n.String(), orgID, m.ID,
		), AuditActionDelete, m, nil); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return &emptypb.Empty{}, nil
	})
}

// fetchAccountsByIDs fetches multiple accounts by ID and returns a map keyed by account ID.
// Accounts that cannot be found are omitted from the map.
func (s *budgetAccountValueServiceServer) fetchAccountsByIDs(ctx context.Context, accountRepo *repository.AccountRepository, ids []uuid.UUID) map[uuid.UUID]*model.Account {
	result := make(map[uuid.UUID]*model.Account, len(ids))
	for _, id := range ids {
		if a, err := accountRepo.GetByID(ctx, id); err == nil {
			result[id] = a
		}
	}
	return result
}
