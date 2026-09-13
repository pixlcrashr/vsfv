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
	"github.com/theater-improrama/go-utils/optional"
	"gorm.io/gen/field"
	"gorm.io/gorm"
)

var (
	ErrAccountGroupAssignmentNotFound      = errors.New("account group assignment not found")
	ErrAccountGroupAssignmentAlreadyExists = errors.New("account group assignment already exists")
)

// AccountGroupAssignmentOrderFieldMapper maps API order_by field names to database column names.
var AccountGroupAssignmentOrderFieldMapper = order.FieldMapper{
	"accountId":  "account_id",
	"negate":     "negate",
	"createTime": "created_at",
}

// ListAccountGroupAssignmentsParams drives the List query.
type ListAccountGroupAssignmentsParams struct {
	AccountGroupID uuid.UUID
	// Cond is an optional abstract condition chain (AND/OR/NOT support).
	Cond cond.Cond
	// OrderBy specifies the sort field and direction as SQL expressions.
	OrderBy []order.Expr
	// Page number (1-indexed).
	Page int
	// PageSize caps the number of rows returned.
	PageSize int
}

// accountGroupAssignmentColumnMapper maps filter field names to database column names.
func accountGroupAssignmentColumnMapper(field string) (string, bool) {
	switch field {
	case "account_id":
		return "account_id", true
	case "negate":
		return "negate", true
	default:
		return "", false
	}
}

// AccountGroupAssignmentRepository provides CRUD for account_group_assignments table.
type AccountGroupAssignmentRepository struct {
	db *gorm.DB
	q  *dao.Query
}

func NewAccountGroupAssignmentRepository(db *gorm.DB) *AccountGroupAssignmentRepository {
	return &AccountGroupAssignmentRepository{db: db, q: dao.Use(db)}
}

func (r *AccountGroupAssignmentRepository) List(ctx context.Context, params ListAccountGroupAssignmentsParams) ([]*model.AccountGroupAssignment, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	db := r.db.WithContext(ctx).Table("account_group_assignments").
		Where("account_group_id = ?", params.AccountGroupID)

	// Apply abstract condition chain
	db = cond.Apply(db, params.Cond, accountGroupAssignmentColumnMapper)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count account group assignments account_group_id=%s: %w", params.AccountGroupID, err)
	}

	if len(params.OrderBy) > 0 {
		for _, expr := range params.OrderBy {
			db = db.Order(expr.String())
		}
	} else {
		db = db.Order("created_at DESC")
	}

	offset := (params.Page - 1) * params.PageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(params.PageSize)

	var ms []*model.AccountGroupAssignment
	if err := db.Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list account group assignments account_group_id=%s: %w", params.AccountGroupID, err)
	}

	return ms, total, nil
}

func (r *AccountGroupAssignmentRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.AccountGroupAssignment, error) {
	m, err := r.q.AccountGroupAssignment.WithContext(ctx).Where(r.q.AccountGroupAssignment.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrAccountGroupAssignmentNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get account group assignment id=%s: %w", id, err)
	}
	return m, nil
}

// CreateAccountGroupAssignmentParams holds the fields required to create an account group assignment.
type CreateAccountGroupAssignmentParams struct {
	OrganizationID uuid.UUID
	AccountGroupID uuid.UUID
	AccountID      uuid.UUID
	Negate         bool
	CustomID       string
}

func (r *AccountGroupAssignmentRepository) Create(ctx context.Context, params CreateAccountGroupAssignmentParams) (*model.AccountGroupAssignment, error) {
	groupCount, err := r.q.AccountGroup.WithContext(ctx).Where(r.q.AccountGroup.ID.Eq(params.AccountGroupID)).Count()
	if err != nil {
		return nil, fmt.Errorf("create account group assignment: check account group account_group_id=%s: %w", params.AccountGroupID, err)
	}
	if groupCount == 0 {
		return nil, errors.Join(ErrAccountGroupNotFound, fmt.Errorf("account_group_id=%s: %w", params.AccountGroupID, gorm.ErrRecordNotFound))
	}
	accountCount, err := r.q.Account.WithContext(ctx).Where(r.q.Account.ID.Eq(params.AccountID)).Count()
	if err != nil {
		return nil, fmt.Errorf("create account group assignment: check account account_id=%s: %w", params.AccountID, err)
	}
	if accountCount == 0 {
		return nil, errors.Join(ErrAccountNotFound, fmt.Errorf("account_id=%s: %w", params.AccountID, gorm.ErrRecordNotFound))
	}
	m := &model.AccountGroupAssignment{
		OrganizationID: params.OrganizationID,
		AccountGroupID: params.AccountGroupID,
		AccountID:      params.AccountID,
		Negate:         params.Negate,
		CustomID:       params.CustomID,
	}
	if err := r.q.AccountGroupAssignment.WithContext(ctx).Create(m); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, errors.Join(ErrAccountGroupAssignmentAlreadyExists, fmt.Errorf("account_group_id=%s account_id=%s: %w", m.AccountGroupID, m.AccountID, err))
		}
		return nil, fmt.Errorf("create account group assignment account_group_id=%s account_id=%s: %w", m.AccountGroupID, m.AccountID, err)
	}
	return m, nil
}

// UpdateAccountGroupAssignmentParams holds the fields that can be updated for an account group assignment.
type UpdateAccountGroupAssignmentParams struct {
	AccountID optional.Optional[uuid.UUID]
	Negate    optional.Optional[bool]
	CustomID  optional.Optional[string]
}

// Update updates fields of an existing account group assignment matched by its primary key.
func (r *AccountGroupAssignmentRepository) Update(ctx context.Context, id uuid.UUID, params UpdateAccountGroupAssignmentParams) error {
	var cols []field.AssignExpr

	if params.AccountID.IsSet {
		cols = append(cols, r.q.AccountGroupAssignment.AccountID.Value(params.AccountID.Value))
	}
	if params.Negate.IsSet {
		cols = append(cols, r.q.AccountGroupAssignment.Negate.Value(params.Negate.Value))
	}
	if params.CustomID.IsSet {
		cols = append(cols, r.q.AccountGroupAssignment.CustomID.Value(params.CustomID.Value))
	}

	if len(cols) == 0 {
		return nil
	}

	if _, err := r.q.AccountGroupAssignment.WithContext(ctx).Where(r.q.AccountGroupAssignment.ID.Eq(id)).UpdateSimple(cols...); err != nil {
		return fmt.Errorf("update account group assignment id=%s: %w", id, err)
	}
	return nil
}

func (r *AccountGroupAssignmentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.q.AccountGroupAssignment.WithContext(ctx).Where(r.q.AccountGroupAssignment.ID.Eq(id)).Delete()
	if err != nil {
		return fmt.Errorf("delete account group assignment id=%s: %w", id, err)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrAccountGroupAssignmentNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}
