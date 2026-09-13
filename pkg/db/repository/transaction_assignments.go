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
	ErrTransactionAssignmentNotFound      = errors.New("transaction assignment not found")
	ErrTransactionAssignmentAlreadyExists = errors.New("transaction assignment already exists")
)

// TransactionAssignmentOrderFieldMapper maps API order_by field names to database column names.
var TransactionAssignmentOrderFieldMapper = order.FieldMapper{
	"createTime": "created_at",
	"updateTime": "updated_at",
}

// ListTransactionAssignmentsParams drives the List query.
type ListTransactionAssignmentsParams struct {
	// TransactionID filters to a single transaction. When uuid.Nil, all
	// transactions within OrganizationID are returned (wildcard parent).
	TransactionID uuid.UUID
	// OrganizationID filters by organization. Required when TransactionID
	// is uuid.Nil; ignored otherwise (TransactionID already implies the org).
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

// transactionAssignmentColumnMapper maps filter field names to database column names.
func transactionAssignmentColumnMapper(field string) (string, bool) {
	switch field {
	case "account":
		return "account_id", true
	case "transaction":
		return "transaction_id", true
	default:
		return "", false
	}
}

type TransactionAssignmentRepository struct {
	db *gorm.DB
	q  *dao.Query
}

func NewTransactionAssignmentRepository(db *gorm.DB) *TransactionAssignmentRepository {
	return &TransactionAssignmentRepository{db: db, q: dao.Use(db)}
}

func (r *TransactionAssignmentRepository) List(ctx context.Context, params ListTransactionAssignmentsParams) ([]*model.TransactionAssignment, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	db := r.db.WithContext(ctx).Table("transaction_assignments")

	if params.TransactionID != uuid.Nil {
		db = db.Where("transaction_id = ?", params.TransactionID)
	} else if params.OrganizationID != uuid.Nil {
		db = db.Where("organization_id = ?", params.OrganizationID)
	} else {
		return nil, 0, fmt.Errorf("list transaction assignments: either TransactionID or OrganizationID must be set")
	}

	// Apply abstract condition chain
	db = cond.Apply(db, params.Cond, transactionAssignmentColumnMapper)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count transaction assignments transaction_id=%s: %w", params.TransactionID, err)
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

	var ms []*model.TransactionAssignment
	if err := db.Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list transaction assignments transaction_id=%s: %w", params.TransactionID, err)
	}

	return ms, total, nil
}

func (r *TransactionAssignmentRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.TransactionAssignment, error) {
	m, err := r.q.TransactionAssignment.WithContext(ctx).Where(r.q.TransactionAssignment.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrTransactionAssignmentNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get transaction assignment id=%s: %w", id, err)
	}
	return m, nil
}

// CreateTransactionAssignmentParams holds the fields required to create a transaction assignment.
type CreateTransactionAssignmentParams struct {
	OrganizationID uuid.UUID
	TransactionID  uuid.UUID
	AccountID      uuid.UUID
	Value          apd.Decimal
}

func (r *TransactionAssignmentRepository) Create(ctx context.Context, params CreateTransactionAssignmentParams) (*model.TransactionAssignment, error) {
	transCount, err := r.q.Transaction_.WithContext(ctx).Where(r.q.Transaction_.ID.Eq(params.TransactionID)).Count()
	if err != nil {
		return nil, fmt.Errorf("create transaction assignment: check transaction transaction_id=%s: %w", params.TransactionID, err)
	}
	if transCount == 0 {
		return nil, errors.Join(ErrTransactionNotFound, fmt.Errorf("transaction_id=%s: %w", params.TransactionID, gorm.ErrRecordNotFound))
	}
	existingCount, err := r.q.TransactionAssignment.WithContext(ctx).Where(
		r.q.TransactionAssignment.TransactionID.Eq(params.TransactionID),
		r.q.TransactionAssignment.AccountID.Eq(params.AccountID),
	).Count()
	if err != nil {
		return nil, fmt.Errorf("create transaction assignment: check existing assignment transaction_id=%s account_id=%s: %w", params.TransactionID, params.AccountID, err)
	}
	if existingCount > 0 {
		return nil, errors.Join(ErrTransactionAssignmentAlreadyExists, fmt.Errorf("transaction_id=%s account_id=%s", params.TransactionID, params.AccountID))
	}
	m := &model.TransactionAssignment{
		OrganizationID: params.OrganizationID,
		TransactionID:  params.TransactionID,
		AccountID:      params.AccountID,
		Value:          params.Value,
	}
	if err := r.q.TransactionAssignment.WithContext(ctx).Create(m); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, errors.Join(ErrTransactionAssignmentAlreadyExists, fmt.Errorf("transaction_id=%s account_id=%s: %w", m.TransactionID, m.AccountID, err))
		}
		return nil, fmt.Errorf("create transaction assignment transaction_id=%s: %w", m.TransactionID, err)
	}
	return m, nil
}

// UpdateTransactionAssignmentParams holds the fields that can be updated for a transaction assignment.
type UpdateTransactionAssignmentParams struct {
	AccountID optional.Optional[uuid.UUID]
	Value     optional.Optional[apd.Decimal]
	CustomID  optional.Optional[string]
}

// Update updates fields of an existing transaction assignment.
func (r *TransactionAssignmentRepository) Update(ctx context.Context, id uuid.UUID, params UpdateTransactionAssignmentParams) error {
	var cols []field.AssignExpr

	if params.AccountID.IsSet {
		m, err := r.GetByID(ctx, id)
		if err != nil {
			return err
		}
		existingCount, err := r.q.TransactionAssignment.WithContext(ctx).
			Where(r.q.TransactionAssignment.TransactionID.Eq(m.TransactionID)).
			Where(r.q.TransactionAssignment.AccountID.Eq(params.AccountID.Value)).
			Where(r.q.TransactionAssignment.ID.Neq(id)).
			Count()
		if err != nil {
			return fmt.Errorf("update transaction assignment id=%s: check existing assignment: %w", id, err)
		}
		if existingCount > 0 {
			return errors.Join(ErrTransactionAssignmentAlreadyExists, fmt.Errorf("id=%s transaction_id=%s account_id=%s", id, m.TransactionID, params.AccountID.Value))
		}
		cols = append(cols, r.q.TransactionAssignment.AccountID.Value(params.AccountID.Value))
	}

	if params.Value.IsSet {
		cols = append(cols, r.q.TransactionAssignment.Value.Value(params.Value.Value))
	}

	if len(cols) == 0 {
		return nil
	}

	if _, err := r.q.TransactionAssignment.WithContext(ctx).Where(r.q.TransactionAssignment.ID.Eq(id)).UpdateSimple(cols...); err != nil {
		return fmt.Errorf("update transaction assignment id=%s: %w", id, err)
	}
	return nil
}

func (r *TransactionAssignmentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.q.TransactionAssignment.WithContext(ctx).Where(r.q.TransactionAssignment.ID.Eq(id)).Delete()
	if err != nil {
		return fmt.Errorf("delete transaction assignment id=%s: %w", id, err)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrTransactionAssignmentNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}
