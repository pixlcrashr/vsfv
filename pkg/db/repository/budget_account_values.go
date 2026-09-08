package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/model/dao"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"gorm.io/gen/field"
	"gorm.io/gorm"
)

var (
	ErrBudgetAccountValueNotFound      = errors.New("budget account value not found")
	ErrBudgetAccountValueAlreadyExists = errors.New("budget account value already exists")
)

// BudgetAccountValueOrderFieldMapper maps API order_by field names to DB column names.
var BudgetAccountValueOrderFieldMapper = order.FieldMapper{
	"account":    "account_id",
	"value":      "value",
	"createTime": "created_at",
	"updateTime": "updated_at",
}

// ListBudgetAccountValuesParams drives the List query.
type ListBudgetAccountValuesParams struct {
	OrganizationID uuid.UUID
	BudgetID       uuid.UUID
	Cond           cond.Cond
	OrderBy        []order.Expr
	Page           int
	PageSize       int
}

func budgetAccountValueColumnMapper(field string) (string, bool) {
	switch field {
	case "account":
		return "account_id", true
	default:
		return "", false
	}
}

// BudgetAccountValueRepository provides CRUD for the budget_account_values table.
type BudgetAccountValueRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewBudgetAccountValueRepository creates a BudgetAccountValueRepository backed by db.
func NewBudgetAccountValueRepository(db *gorm.DB) *BudgetAccountValueRepository {
	return &BudgetAccountValueRepository{db: db, q: dao.Use(db)}
}

// List returns budget account values for the given budget.
func (r *BudgetAccountValueRepository) List(ctx context.Context, params ListBudgetAccountValuesParams) ([]*model.BudgetAccountValue, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	db := r.db.WithContext(ctx).Table("budget_account_values").
		Where("budget_id = ?", params.BudgetID)
	if params.OrganizationID != (uuid.UUID{}) {
		db = db.Where("organization_id = ?", params.OrganizationID)
	}

	db = cond.Apply(db, params.Cond, budgetAccountValueColumnMapper)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count budget account values budget_id=%s: %w", params.BudgetID, err)
	}

	if len(params.OrderBy) > 0 {
		for _, expr := range params.OrderBy {
			db = db.Order(expr.String())
		}
	} else {
		db = db.Order("created_at ASC")
	}

	offset := (params.Page - 1) * params.PageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(params.PageSize)

	var ms []*model.BudgetAccountValue
	if err := db.Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list budget account values budget_id=%s: %w", params.BudgetID, err)
	}
	return ms, total, nil
}

// GetByID returns the budget account value with the given ID.
func (r *BudgetAccountValueRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.BudgetAccountValue, error) {
	var m model.BudgetAccountValue
	if err := r.db.WithContext(ctx).Table("budget_account_values").Where("id = ?", id).First(&m).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrBudgetAccountValueNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get budget account value id=%s: %w", id, err)
	}
	return &m, nil
}

// CreateBudgetAccountValueParams holds the fields required to create a budget account value.
type CreateBudgetAccountValueParams struct {
	OrganizationID uuid.UUID
	BudgetID       uuid.UUID
	AccountID      uuid.UUID
	Value          apd.Decimal
	CustomID       string
}

// Create inserts a new budget account value.
func (r *BudgetAccountValueRepository) Create(ctx context.Context, params CreateBudgetAccountValueParams) (*model.BudgetAccountValue, error) {
	var budgetCount int64
	if err := r.db.WithContext(ctx).Table("budgets").Where("id = ?", params.BudgetID).Count(&budgetCount).Error; err != nil {
		return nil, fmt.Errorf("create budget account value: check budget budget_id=%s: %w", params.BudgetID, err)
	}
	if budgetCount == 0 {
		return nil, errors.Join(ErrBudgetNotFound, fmt.Errorf("budget_id=%s: %w", params.BudgetID, gorm.ErrRecordNotFound))
	}
	var accountCount int64
	if err := r.db.WithContext(ctx).Table("accounts").Where("id = ?", params.AccountID).Count(&accountCount).Error; err != nil {
		return nil, fmt.Errorf("create budget account value: check account account_id=%s: %w", params.AccountID, err)
	}
	if accountCount == 0 {
		return nil, errors.Join(ErrAccountNotFound, fmt.Errorf("account_id=%s: %w", params.AccountID, gorm.ErrRecordNotFound))
	}
	m := &model.BudgetAccountValue{
		OrganizationID: params.OrganizationID,
		BudgetID:       params.BudgetID,
		AccountID:      params.AccountID,
		Value:          params.Value,
		CustomID:       params.CustomID,
	}
	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, errors.Join(ErrBudgetAccountValueAlreadyExists, fmt.Errorf("budget_id=%s account_id=%s: %w", m.BudgetID, m.AccountID, err))
		}
		return nil, fmt.Errorf("create budget account value budget_id=%s account_id=%s: %w", m.BudgetID, m.AccountID, err)
	}
	return m, nil
}

// UpdateBudgetAccountValueParams holds the fields that can be updated for a budget account value.
type UpdateBudgetAccountValueParams struct {
	Value    optional.Optional[apd.Decimal]
	CustomID optional.Optional[string]
}

// Update saves changes to an existing budget account value.
func (r *BudgetAccountValueRepository) Update(ctx context.Context, id uuid.UUID, params UpdateBudgetAccountValueParams) error {
	var cols []field.AssignExpr

	if params.Value.IsSet {
		cols = append(cols, r.q.BudgetAccountValue.Value.Value(params.Value.Value))
	}

	if params.CustomID.IsSet {
		cols = append(cols, r.q.BudgetAccountValue.CustomID.Value(params.CustomID.Value))
	}

	if _, err := r.q.BudgetAccountValue.WithContext(ctx).Where(r.q.BudgetAccountValue.ID.Eq(id)).UpdateSimple(cols...); err != nil {
		return fmt.Errorf("update budget account value id=%s: %w", id, err)
	}
	return nil
}

// Delete removes the budget account value with the given ID.
func (r *BudgetAccountValueRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).Table("budget_account_values").Where("id = ?", id).Delete(&model.BudgetAccountValue{})
	if result.Error != nil {
		return fmt.Errorf("delete budget account value id=%s: %w", id, result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrBudgetAccountValueNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}

// GetByBudgetAndAccountIDs returns the account values of a budget for the
// given accounts. Used to capture before-state for batch upsert audits.
func (r *BudgetAccountValueRepository) GetByBudgetAndAccountIDs(ctx context.Context, orgID, budgetID uuid.UUID, accountIDs []uuid.UUID) ([]*model.BudgetAccountValue, error) {
	var ms []*model.BudgetAccountValue
	if len(accountIDs) == 0 {
		return ms, nil
	}
	err := r.db.WithContext(ctx).
		Table("budget_account_values").
		Where("organization_id = ? AND budget_id = ? AND account_id IN ?", orgID, budgetID, accountIDs).
		Find(&ms).Error
	if err != nil {
		return nil, fmt.Errorf("get budget account values budget_id=%s: %w", budgetID, err)
	}
	return ms, nil
}

// UpsertEntry carries the data for a single BatchUpsert entry.
type UpsertEntry struct {
	AccountID uuid.UUID
	Value     apd.Decimal
}

// BatchUpsert creates or updates account values for the given org+budget.
// For each entry, if a row with (organization_id, budget_id, account_id) already
// exists its value is updated; otherwise a new row is inserted.
func (r *BudgetAccountValueRepository) BatchUpsert(ctx context.Context, orgID, budgetID uuid.UUID, entries []UpsertEntry) ([]*model.BudgetAccountValue, error) {
	var results []*model.BudgetAccountValue
	for _, e := range entries {
		var existing model.BudgetAccountValue
		err := r.db.WithContext(ctx).
			Table("budget_account_values").
			Where("organization_id = ? AND budget_id = ? AND account_id = ?", orgID, budgetID, e.AccountID).
			First(&existing).Error
		if err == nil {
			existing.Value = e.Value
			if err := r.db.WithContext(ctx).Save(&existing).Error; err != nil {
				return nil, fmt.Errorf("batch upsert budget account value (update) budget_id=%s account_id=%s: %w", budgetID, e.AccountID, err)
			}
			results = append(results, &existing)
		} else {
			m := &model.BudgetAccountValue{
				OrganizationID: orgID,
				BudgetID:       budgetID,
				AccountID:      e.AccountID,
				Value:          e.Value,
			}
			if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
				return nil, fmt.Errorf("batch upsert budget account value (create) budget_id=%s account_id=%s: %w", budgetID, e.AccountID, err)
			}
			results = append(results, m)
		}
	}
	return results, nil
}
