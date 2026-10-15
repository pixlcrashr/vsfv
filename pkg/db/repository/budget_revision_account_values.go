package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/model/dao"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"gorm.io/gorm"
)

var ErrBudgetRevisionAccountValueNotFound = errors.New("budget revision account value not found")

// ListBudgetRevisionAccountValuesParams drives the List query.
type ListBudgetRevisionAccountValuesParams struct {
	// BudgetRevisionID selects the values of a single revision. Mutually
	// exclusive with BudgetRevisionIDs.
	BudgetRevisionID uuid.UUID
	// BudgetRevisionIDs selects the values of multiple revisions in one query.
	// Takes precedence over BudgetRevisionID when non-empty.
	BudgetRevisionIDs []uuid.UUID
	Cond              cond.Cond
	OrderBy           []order.Expr
	Page              int
	PageSize          int
}

func budgetRevisionAccountValueColumnMapper(field string) (string, bool) {
	switch field {
	case "account":
		return "account_id", true
	default:
		return "", false
	}
}

// BudgetRevisionAccountValueRepository provides read-only access to budget_revision_account_values.
type BudgetRevisionAccountValueRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewBudgetRevisionAccountValueRepository creates a repository backed by db.
func NewBudgetRevisionAccountValueRepository(db *gorm.DB) *BudgetRevisionAccountValueRepository {
	return &BudgetRevisionAccountValueRepository{db: db, q: dao.Use(db)}
}

// List returns account values for the given revision or revisions.
func (r *BudgetRevisionAccountValueRepository) List(ctx context.Context, params ListBudgetRevisionAccountValuesParams) ([]*model.BudgetRevisionAccountValue, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	db := r.db.WithContext(ctx).Table("budget_revision_account_values")
	if len(params.BudgetRevisionIDs) > 0 {
		db = db.Where("budget_revision_id IN ?", params.BudgetRevisionIDs)
	} else {
		db = db.Where("budget_revision_id = ?", params.BudgetRevisionID)
	}

	db = cond.Apply(db, params.Cond, budgetRevisionAccountValueColumnMapper)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count budget revision account values budget_revision_id=%s: %w", params.BudgetRevisionID, err)
	}

	if len(params.OrderBy) > 0 {
		for _, expr := range params.OrderBy {
			db = db.Order(expr.String())
		}
	} else {
		db = db.Order("created_at ASC")
	}
	// Deterministic tiebreaker so offset pagination is stable across pages.
	db = db.Order("account_id ASC")

	offset := (params.Page - 1) * params.PageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(params.PageSize)

	var ms []*model.BudgetRevisionAccountValue
	if err := db.Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list budget revision account values budget_revision_id=%s: %w", params.BudgetRevisionID, err)
	}

	return ms, total, nil
}

// GetByID returns the account value with the given ID.
func (r *BudgetRevisionAccountValueRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.BudgetRevisionAccountValue, error) {
	m, err := r.q.BudgetRevisionAccountValue.WithContext(ctx).Where(r.q.BudgetRevisionAccountValue.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrBudgetRevisionAccountValueNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get budget revision account value id=%s: %w", id, err)
	}

	return m, nil
}
