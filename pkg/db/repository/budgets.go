package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

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
	ErrBudgetNotFound      = errors.New("budget not found")
	ErrBudgetAlreadyExists = errors.New("budget already exists")
)

// BudgetOrderFieldMapper maps API order_by field names to database column names.
var BudgetOrderFieldMapper = order.FieldMapper{
	"displayName":        "display_name",
	"displayDescription": "display_description",
	"isClosed":           "is_closed",
	"periodStart":        "period_start",
	"periodEnd":          "period_end",
	"createTime":         "created_at",
	"updateTime":         "updated_at",
	"order":              "sort_order",
}

// ListBudgetsParams drives the List query.
type ListBudgetsParams struct {
	// OrganizationID restricts results to a single organization.
	OrganizationID uuid.UUID
	// Cond is an optional abstract condition chain (AND/OR/NOT support).
	Cond cond.Cond
	// OrderBy specifies the sort field and direction as SQL expressions.
	OrderBy []order.Expr
	// Page number (1-indexed).
	Page int
	// PageSize caps the number of rows returned.
	PageSize int
}

// budgetColumnMapper maps filter field names to database column names.
func budgetColumnMapper(field string) (string, bool) {
	switch field {
	case "display_name":
		return "display_name", true
	case "is_closed":
		return "is_closed", true
	default:
		return "", false
	}
}

// BudgetRepository provides CRUD and specialised queries for the budgets table.
type BudgetRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewBudgetRepository creates a BudgetRepository backed by db.
func NewBudgetRepository(db *gorm.DB) *BudgetRepository {
	return &BudgetRepository{db: db, q: dao.Use(db)}
}

// List returns budgets matching params along with the total count.
func (r *BudgetRepository) List(ctx context.Context, params ListBudgetsParams) ([]*model.Budget, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	base := r.db.WithContext(ctx).Table("budgets")
	if params.OrganizationID != (uuid.UUID{}) {
		base = base.Where("organization_id = ?", params.OrganizationID)
	}

	var db *gorm.DB

	// When condition chain is present, use raw GORM for flexible SQL
	if params.Cond != nil && !params.Cond.IsEmpty() {
		db = base

		// Apply abstract condition chain
		db = cond.Apply(db, params.Cond, budgetColumnMapper)
	} else {
		db = base
	}

	// Get total count before pagination
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count budgets organization_id=%s: %w", params.OrganizationID, err)
	}

	// Apply ordering
	if len(params.OrderBy) > 0 {
		for _, expr := range params.OrderBy {
			db = db.Order(expr.String())
		}
	} else {
		db = db.Order("sort_order ASC, created_at ASC")
	}

	// Apply pagination
	offset := (params.Page - 1) * params.PageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(params.PageSize)

	var ms []*model.Budget
	if err := db.Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list budgets organization_id=%s: %w", params.OrganizationID, err)
	}

	return ms, total, nil
}

// GetByID returns the budget with the given ID.
func (r *BudgetRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Budget, error) {
	m, err := r.q.Budget.WithContext(ctx).Where(r.q.Budget.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrBudgetNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get budget id=%s: %w", id, err)
	}
	return m, nil
}

// GetByCustomID returns the budget with the given custom ID within an organization.
func (r *BudgetRepository) GetByCustomID(ctx context.Context, orgID uuid.UUID, customID string) (*model.Budget, error) {
	m, err := r.q.Budget.WithContext(ctx).Where(
		r.q.Budget.OrganizationID.Eq(orgID),
		r.q.Budget.CustomID.Eq(customID),
	).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrBudgetNotFound, fmt.Errorf("organization_id=%s custom_id=%s: %w", orgID, customID, err))
		}
		return nil, fmt.Errorf("get budget organization_id=%s custom_id=%s: %w", orgID, customID, err)
	}
	return m, nil
}

// GetByResourceName resolves a budget by organization and budget identifiers, each of
// which may be either a UUID or a custom ID.
func (r *BudgetRepository) GetByResourceName(ctx context.Context, organization string, budget string) (*model.Budget, error) {
	var orgID uuid.UUID
	orgID, _ = uuid.Parse(organization)

	o, err := r.q.Organization.WithContext(ctx).Where(
		field.Or(
			r.q.Organization.CustomID.Eq(organization),
			r.q.Organization.ID.Eq(orgID),
		),
	).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrOrganizationNotFound, fmt.Errorf("organization=%s: %w", organization, err))
		}
		return nil, fmt.Errorf("get organization organization=%s: %w", organization, err)
	}

	var budgetID uuid.UUID
	budgetID, _ = uuid.Parse(budget)

	m, err := r.q.Budget.WithContext(ctx).Where(
		r.q.Budget.OrganizationID.Eq(o.ID),
		field.Or(
			r.q.Budget.CustomID.Eq(budget),
			r.q.Budget.ID.Eq(budgetID),
		),
	).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrBudgetNotFound, fmt.Errorf("budget=%s: %w", budget, err))
		}
		return nil, fmt.Errorf("get budget budget=%s: %w", budget, err)
	}
	return m, nil
}

// ListAll returns all budgets of an organization in their custom order.
func (r *BudgetRepository) ListAll(ctx context.Context, orgID uuid.UUID) ([]*model.Budget, error) {
	ms, err := r.q.Budget.WithContext(ctx).Where(
		r.q.Budget.OrganizationID.Eq(orgID),
	).Order(r.q.Budget.Order, r.q.Budget.CreatedAt).Find()
	if err != nil {
		return nil, fmt.Errorf("list all budgets organization_id=%s: %w", orgID, err)
	}
	return ms, nil
}

// CreateBudgetParams holds the fields required to create a budget.
type CreateBudgetParams struct {
	OrganizationID           uuid.UUID
	DisplayName              string
	DisplayDescription       string
	PeriodStart              time.Time
	PeriodEnd                time.Time
	IsClosed                 bool
	IsPublished              bool
	PublishActualValues      bool
	PublishActualValuesUntil *time.Time
	CustomID                 string
}

// Create inserts a new budget.
func (r *BudgetRepository) Create(ctx context.Context, params CreateBudgetParams) (*model.Budget, error) {
	orgCount, err := r.q.Organization.WithContext(ctx).Where(r.q.Organization.ID.Eq(params.OrganizationID)).Count()
	if err != nil {
		return nil, fmt.Errorf("create budget: check organization organization_id=%s: %w", params.OrganizationID, err)
	}
	if orgCount == 0 {
		return nil, errors.Join(ErrOrganizationNotFound, fmt.Errorf("organization_id=%s: %w", params.OrganizationID, gorm.ErrRecordNotFound))
	}

	// New budgets are appended after the current last one in the
	// organization's custom ordering.
	var maxOrder int32
	if err := r.db.WithContext(ctx).Model(&model.Budget{}).
		Where("organization_id = ?", params.OrganizationID).
		Select("COALESCE(MAX(sort_order), -1)").
		Scan(&maxOrder).Error; err != nil {
		return nil, fmt.Errorf("create budget: get max order organization_id=%s: %w", params.OrganizationID, err)
	}

	m := &model.Budget{
		OrganizationID:      params.OrganizationID,
		DisplayName:         params.DisplayName,
		DisplayDescription:  params.DisplayDescription,
		PeriodStart:         params.PeriodStart,
		PeriodEnd:           params.PeriodEnd,
		IsClosed:            params.IsClosed,
		IsPublished:         params.IsPublished,
		PublishActualValues: params.PublishActualValues,
		CustomID:            params.CustomID,
		Order:               maxOrder + 1,
	}
	if params.PublishActualValuesUntil != nil {
		m.PublishActualValuesUntil = sql.NullTime{Time: *params.PublishActualValuesUntil, Valid: true}
	}
	if err := r.q.Budget.WithContext(ctx).Create(m); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, errors.Join(ErrBudgetAlreadyExists, fmt.Errorf("organization_id=%s custom_id=%s: %w", m.OrganizationID, m.CustomID, err))
		}
		return nil, fmt.Errorf("create budget organization_id=%s custom_id=%s: %w", m.OrganizationID, m.CustomID, err)
	}
	return m, nil
}

// UpdateBudgetParams holds the fields that can be updated for a budget.
type UpdateBudgetParams struct {
	DisplayName              optional.Optional[string]
	DisplayDescription       optional.Optional[string]
	PeriodStart              optional.Optional[time.Time]
	PeriodEnd                optional.Optional[time.Time]
	IsClosed                 optional.Optional[bool]
	IsPublished              optional.Optional[bool]
	PublishActualValues      optional.Optional[bool]
	PublishActualValuesUntil optional.Optional[sql.NullTime]
	CustomID                 optional.Optional[string]
}

// Update updates fields of an existing budget matched by its primary key.
func (r *BudgetRepository) Update(ctx context.Context, id uuid.UUID, params UpdateBudgetParams) error {
	var cols []field.AssignExpr

	if params.DisplayName.IsSet {
		cols = append(cols, r.q.Budget.DisplayName.Value(params.DisplayName.Value))
	}

	if params.DisplayDescription.IsSet {
		cols = append(cols, r.q.Budget.DisplayDescription.Value(params.DisplayDescription.Value))
	}

	if params.PeriodStart.IsSet {
		cols = append(cols, r.q.Budget.PeriodStart.Value(params.PeriodStart.Value))
	}

	if params.PeriodEnd.IsSet {
		cols = append(cols, r.q.Budget.PeriodEnd.Value(params.PeriodEnd.Value))
	}

	if params.IsClosed.IsSet {
		cols = append(cols, r.q.Budget.IsClosed.Value(params.IsClosed.Value))
	}

	if params.IsPublished.IsSet {
		cols = append(cols, r.q.Budget.IsPublished.Value(params.IsPublished.Value))
	}

	if params.PublishActualValues.IsSet {
		cols = append(cols, r.q.Budget.PublishActualValues.Value(params.PublishActualValues.Value))
	}

	if params.PublishActualValuesUntil.IsSet {
		cols = append(cols, r.q.Budget.PublishActualValuesUntil.Value(params.PublishActualValuesUntil.Value))
	}

	if params.CustomID.IsSet {
		cols = append(cols, r.q.Budget.CustomID.Value(params.CustomID.Value))
	}

	if len(cols) == 0 {
		return nil
	}

	if _, err := r.q.Budget.WithContext(ctx).Where(r.q.Budget.ID.Eq(id)).UpdateSimple(cols...); err != nil {
		return fmt.Errorf("update budget id=%s: %w", id, err)
	}

	return nil
}

// Reorder assigns sequential custom orders (0..n-1) to the given budget IDs,
// in the order they are provided. Rows whose order already matches are left
// untouched. IDs must belong to the same organization.
func (r *BudgetRepository) Reorder(ctx context.Context, ids []uuid.UUID) error {
	for i, id := range ids {
		if _, err := r.q.Budget.WithContext(ctx).Where(
			r.q.Budget.ID.Eq(id),
			r.q.Budget.Order.Neq(int32(i)),
		).Update(r.q.Budget.Order, int32(i)); err != nil {
			return fmt.Errorf("reorder budget id=%s: %w", id, err)
		}
	}
	return nil
}

// Delete removes the budget with the given ID.
func (r *BudgetRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.q.Budget.WithContext(ctx).Where(r.q.Budget.ID.Eq(id)).Delete()
	if err != nil {
		return fmt.Errorf("delete budget id=%s: %w", id, err)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrBudgetNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}
