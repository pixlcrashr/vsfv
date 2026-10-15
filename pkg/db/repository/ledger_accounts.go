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
	ErrLedgerAccountNotFound      = errors.New("ledger account not found")
	ErrLedgerAccountAlreadyExists = errors.New("ledger account already exists")
)

// LedgerAccountOrderFieldMapper maps API order_by field names to database column names.
var LedgerAccountOrderFieldMapper = order.FieldMapper{
	"type":        "type",
	"code":        "code",
	"displayName": "display_name",
	"createTime":  "created_at",
	"updateTime":  "updated_at",
}

// ListLedgerAccountsParams drives the List query.
type ListLedgerAccountsParams struct {
	// Cond is an optional abstract condition chain (AND/OR/NOT support).
	Cond cond.Cond
	// OrderBy specifies the sort field and direction as SQL expressions.
	OrderBy []order.Expr
	// Page number (1-indexed).
	Page int
	// PageSize caps the number of rows returned.
	PageSize int
}

// ledgerAccountColumnMapper maps filter field names to database column names.
func ledgerAccountColumnMapper(field string) (string, bool) {
	switch field {
	case "code":
		return "code", true
	case "type":
		return "type", true
	case "display_name":
		return "display_name", true
	default:
		return "", false
	}
}

// LedgerAccountRepository provides CRUD for ledger_accounts table.
type LedgerAccountRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewLedgerAccountRepository creates a LedgerAccountRepository backed by db.
func NewLedgerAccountRepository(db *gorm.DB) *LedgerAccountRepository {
	return &LedgerAccountRepository{db: db, q: dao.Use(db)}
}

// List returns ledger accounts matching params along with the total count.
func (r *LedgerAccountRepository) List(ctx context.Context, params ListLedgerAccountsParams) ([]*model.LedgerAccount, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}

	if params.Page <= 0 {
		params.Page = 1
	}

	db := r.db.WithContext(ctx).Table("ledger_accounts")

	// Apply abstract condition chain
	db = cond.Apply(db, params.Cond, ledgerAccountColumnMapper)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count ledger accounts page=%d: %w", params.Page, err)
	}

	if len(params.OrderBy) > 0 {
		for _, expr := range params.OrderBy {
			db = db.Order(expr.String())
		}
	} else {
		db = db.Order("code ASC")
	}

	offset := (params.Page - 1) * params.PageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(params.PageSize)

	var ms []*model.LedgerAccount
	if err := db.Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list ledger accounts page=%d: %w", params.Page, err)
	}

	return ms, total, nil
}

// GetByID returns the ledger account with the given ID.
func (r *LedgerAccountRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.LedgerAccount, error) {
	m, err := r.q.LedgerAccount.WithContext(ctx).Where(r.q.LedgerAccount.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrLedgerAccountNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get ledger account id=%s: %w", id, err)
	}
	return m, nil
}

// BatchGetByCustomID returns ledger accounts for the given custom IDs within an
// organization. The returned slice is 1:1 with the input IDs; missing accounts
// are returned as nil.
func (r *LedgerAccountRepository) BatchGetByCustomID(ctx context.Context, orgID uuid.UUID, customIDs []string) ([]*model.LedgerAccount, error) {
	results := make([]*model.LedgerAccount, len(customIDs))
	if len(customIDs) == 0 {
		return results, nil
	}

	accounts, err := r.q.LedgerAccount.WithContext(ctx).Where(
		r.q.LedgerAccount.OrganizationID.Eq(orgID),
		r.q.LedgerAccount.CustomID.In(customIDs...),
	).Find()
	if err != nil {
		return nil, fmt.Errorf("batch get ledger accounts: %w", err)
	}

	accountByCustomID := make(map[string]*model.LedgerAccount, len(accounts))
	for _, a := range accounts {
		accountByCustomID[a.CustomID] = a
	}

	for i, id := range customIDs {
		results[i] = accountByCustomID[id]
	}

	return results, nil
}

// GetByCustomID returns the ledger account with the given custom ID within an organization.
func (r *LedgerAccountRepository) GetByCustomID(ctx context.Context, orgID uuid.UUID, customID string) (*model.LedgerAccount, error) {
	m, err := r.q.LedgerAccount.WithContext(ctx).Where(
		r.q.LedgerAccount.OrganizationID.Eq(orgID),
		r.q.LedgerAccount.CustomID.Eq(customID),
	).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrLedgerAccountNotFound, fmt.Errorf("organization_id=%s custom_id=%s: %w", orgID, customID, err))
		}
		return nil, fmt.Errorf("get ledger account organization_id=%s custom_id=%s: %w", orgID, customID, err)
	}
	return m, nil
}

// GetByCode returns the ledger account with the given code.
func (r *LedgerAccountRepository) GetByCode(ctx context.Context, code string) (*model.LedgerAccount, error) {
	m, err := r.q.LedgerAccount.WithContext(ctx).Where(r.q.LedgerAccount.Code.Eq(code)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrLedgerAccountNotFound, fmt.Errorf("code=%s: %w", code, err))
		}
		return nil, fmt.Errorf("get ledger account code=%s: %w", code, err)
	}
	return m, nil
}

// CreateLedgerAccountParams holds the fields required to create a ledger account.
type CreateLedgerAccountParams struct {
	OrganizationID     uuid.UUID
	Code               string
	Type               *model.LedgerAccountType
	DisplayName        string
	DisplayDescription string
	CustomID           string
}

// Create inserts a new ledger account.
func (r *LedgerAccountRepository) Create(ctx context.Context, params CreateLedgerAccountParams) (*model.LedgerAccount, error) {
	orgCount, err := r.q.Organization.WithContext(ctx).Where(r.q.Organization.ID.Eq(params.OrganizationID)).Count()
	if err != nil {
		return nil, fmt.Errorf("create ledger account: check organization organization_id=%s: %w", params.OrganizationID, err)
	}
	if orgCount == 0 {
		return nil, errors.Join(ErrOrganizationNotFound, fmt.Errorf("organization_id=%s: %w", params.OrganizationID, gorm.ErrRecordNotFound))
	}
	m := &model.LedgerAccount{
		OrganizationID:     params.OrganizationID,
		Code:               params.Code,
		Type:               params.Type,
		DisplayName:        params.DisplayName,
		DisplayDescription: params.DisplayDescription,
		CustomID:           params.CustomID,
	}
	if err := r.q.LedgerAccount.WithContext(ctx).Create(m); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, errors.Join(ErrLedgerAccountAlreadyExists, fmt.Errorf("organization_id=%s custom_id=%s code=%s: %w", m.OrganizationID, m.CustomID, m.Code, err))
		}
		return nil, fmt.Errorf("create ledger account custom_id=%s: %w", m.CustomID, err)
	}
	return m, nil
}

// UpdateLedgerAccountParams holds the fields that can be updated for a ledger account.
type UpdateLedgerAccountParams struct {
	Code               optional.Optional[string]
	Type               optional.Optional[*model.LedgerAccountType]
	DisplayName        optional.Optional[string]
	DisplayDescription optional.Optional[string]
	CustomID           optional.Optional[string]
}

// Update updates fields of an existing ledger account.
func (r *LedgerAccountRepository) Update(ctx context.Context, id uuid.UUID, params UpdateLedgerAccountParams) error {
	var cols []field.AssignExpr

	if params.Code.IsSet {
		cols = append(cols, r.q.LedgerAccount.Code.Value(params.Code.Value))
	}

	var nullType bool
	if params.Type.IsSet {
		if params.Type.Value == nil {
			// A NULL assignment has no gen field helper; handled below via a
			// plain update.
			nullType = true
		} else {
			cols = append(cols, r.q.LedgerAccount.Type.Value(int(*params.Type.Value)))
		}
	}

	if params.DisplayName.IsSet {
		cols = append(cols, r.q.LedgerAccount.DisplayName.Value(params.DisplayName.Value))
	}

	if params.DisplayDescription.IsSet {
		cols = append(cols, r.q.LedgerAccount.DisplayDescription.Value(params.DisplayDescription.Value))
	}

	if params.CustomID.IsSet {
		cols = append(cols, r.q.LedgerAccount.CustomID.Value(params.CustomID.Value))
	}

	if nullType && len(cols) == 0 {
		if err := r.db.WithContext(ctx).Model(&model.LedgerAccount{}).
			Where("id = ?", id).
			Update("type", nil).Error; err != nil {
			return fmt.Errorf("clear ledger account type id=%s: %w", id, err)
		}
		return nil
	}

	if len(cols) == 0 {
		return nil
	}

	if _, err := r.q.LedgerAccount.WithContext(ctx).Where(r.q.LedgerAccount.ID.Eq(id)).UpdateSimple(cols...); err != nil {
		return fmt.Errorf("update ledger account id=%s: %w", id, err)
	}

	if nullType {
		if err := r.db.WithContext(ctx).Model(&model.LedgerAccount{}).
			Where("id = ?", id).
			Update("type", nil).Error; err != nil {
			return fmt.Errorf("clear ledger account type id=%s: %w", id, err)
		}
	}

	return nil
}

// Delete removes the ledger account with the given ID.
func (r *LedgerAccountRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.q.LedgerAccount.WithContext(ctx).Where(r.q.LedgerAccount.ID.Eq(id)).Delete()
	if err != nil {
		return fmt.Errorf("delete ledger account id=%s: %w", id, err)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrLedgerAccountNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}
