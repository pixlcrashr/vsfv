package repository

import (
	"context"
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
	ErrAccountNotFound      = errors.New("account not found")
	ErrAccountAlreadyExists = errors.New("account already exists")
)

// AccountOrderFieldMapper maps API order_by field names to database column names.
var AccountOrderFieldMapper = order.FieldMapper{
	"displayName":        "display_name",
	"displayCode":        "display_code",
	"displayDescription": "display_description",
	"isContainer":        "is_container",
	"isArchived":         "is_archived",
	"createTime":         "created_at",
	"updateTime":         "updated_at",
}

// ListAccountsParams drives the List query.
type ListAccountsParams struct {
	// OrganizationID restricts results to a single organization.
	OrganizationID uuid.UUID
	// Cond is an optional abstract condition chain (AND/OR/NOT support).
	// When set, it is applied in addition to individual filter fields.
	Cond cond.Cond
	// OrderBy specifies the sort field and direction as SQL expressions.
	OrderBy []order.Expr
	// Page number (1-indexed).
	Page int
	// PageSize caps the number of rows returned.
	PageSize int
}

// accountColumnMapper maps filter field names to database column names.
func accountColumnMapper(field string) (string, bool) {
	switch field {
	case "display_name":
		return "display_name", true
	case "display_code":
		return "display_code", true
	case "is_archived":
		return "is_archived", true
	default:
		return "", false
	}
}

// AccountRepository provides CRUD and specialised queries for the accounts table.
type AccountRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewAccountRepository creates an AccountRepository backed by db.
func NewAccountRepository(db *gorm.DB) *AccountRepository {
	return &AccountRepository{db: db, q: dao.Use(db)}
}

// List returns accounts matching params along with the total count.
func (r *AccountRepository) List(ctx context.Context, params ListAccountsParams) ([]*model.Account, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	base := r.db.WithContext(ctx).Table("accounts")
	if params.OrganizationID != (uuid.UUID{}) {
		base = base.Where("organization_id = ?", params.OrganizationID)
	}

	var db *gorm.DB

	// When condition chain is present, use raw GORM for flexible SQL
	if params.Cond != nil && !params.Cond.IsEmpty() {
		db = base

		// Apply abstract condition chain
		db = cond.Apply(db, params.Cond, accountColumnMapper)
	} else {
		db = base
	}

	// Get total count before pagination
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count accounts organization_id=%s: %w", params.OrganizationID, err)
	}

	// Apply ordering
	if len(params.OrderBy) > 0 {
		for _, expr := range params.OrderBy {
			db = db.Order(expr.String())
		}
	} else {
		db = db.Order("created_at DESC")
	}

	// Apply pagination
	offset := (params.Page - 1) * params.PageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(params.PageSize)

	var ms []*model.Account
	if err := db.Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list accounts organization_id=%s: %w", params.OrganizationID, err)
	}

	return ms, total, nil
}

// GetByID returns the account with the given ID.
func (r *AccountRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Account, error) {
	m, err := r.q.Account.WithContext(ctx).Where(r.q.Account.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrAccountNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get account id=%s: %w", id, err)
	}
	return m, nil
}

// GetByCustomID returns the account with the given custom ID within an organization.
func (r *AccountRepository) GetByCustomID(ctx context.Context, orgID uuid.UUID, customID string) (*model.Account, error) {
	m, err := r.q.Account.WithContext(ctx).Where(
		r.q.Account.OrganizationID.Eq(orgID),
		r.q.Account.CustomID.Eq(customID),
	).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrAccountNotFound, fmt.Errorf("organization_id=%s custom_id=%s: %w", orgID, customID, err))
		}
		return nil, fmt.Errorf("get account organization_id=%s custom_id=%s: %w", orgID, customID, err)
	}
	return m, nil
}

// GetByIDs returns all accounts matching the given IDs in a single query.
// The caller is responsible for mapping returned rows by ID; missing IDs are
// simply omitted from the result.
func (r *AccountRepository) GetByIDs(ctx context.Context, ids []uuid.UUID) ([]*model.Account, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	var ms []*model.Account
	if err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&ms).Error; err != nil {
		return nil, fmt.Errorf("get accounts by ids: %w", err)
	}
	return ms, nil
}

// AccountResourceNameLookup identifies an account by its organization custom ID
// and account custom ID — the two segments of an Account resource name.
type AccountResourceNameLookup struct {
	OrganizationCustomID string
	AccountCustomID      string
}

// BatchGetByResourceName resolves a list of account resource name lookups to
// their model entities in a minimal number of queries. The returned slice is
// 1:1 with the input: each element is either the matching *model.Account or
// nil if no account exists for that lookup. Duplicate lookups are handled
// correctly (each position gets its own pointer).
//
// The underlying query uses a single SELECT with chained OR tuples built via
// the generated DAO:
//
//	WHERE (organization_id = ? AND custom_id = ?)
//	   OR (organization_id = ? AND custom_id = ?)
//	   OR ...
func (r *AccountRepository) BatchGetByResourceName(ctx context.Context, lookups []AccountResourceNameLookup) ([]*model.Account, error) {
	results := make([]*model.Account, len(lookups))
	if len(lookups) == 0 {
		return results, nil
	}

	// Collect unique (orgCustomID, accountCustomID) pairs to query once.
	type key struct {
		orgCustomID string
		customID    string
	}
	uniqueKeys := make([]key, 0, len(lookups))
	seen := make(map[key]struct{}, len(lookups))
	for _, l := range lookups {
		k := key{l.OrganizationCustomID, l.AccountCustomID}
		if _, ok := seen[k]; !ok {
			seen[k] = struct{}{}
			uniqueKeys = append(uniqueKeys, k)
		}
	}

	// Resolve unique organization custom IDs to UUIDs in a single query.
	orgCustomIDs := make([]string, 0, len(uniqueKeys))
	orgSeen := make(map[string]struct{})
	for _, k := range uniqueKeys {
		if _, ok := orgSeen[k.orgCustomID]; !ok {
			orgSeen[k.orgCustomID] = struct{}{}
			orgCustomIDs = append(orgCustomIDs, k.orgCustomID)
		}
	}

	orgs, err := r.q.Organization.WithContext(ctx).Where(r.q.Organization.CustomID.In(orgCustomIDs...)).Find()
	if err != nil {
		return nil, fmt.Errorf("batch get accounts: list organizations: %w", err)
	}
	orgUUIDByCustomID := make(map[string]uuid.UUID, len(orgs))
	for _, o := range orgs {
		orgUUIDByCustomID[o.CustomID] = o.ID
	}

	// Build OR-chained WHERE clause using the DAO field expressions.
	var conds []field.Expr
	for _, k := range uniqueKeys {
		orgUUID, ok := orgUUIDByCustomID[k.orgCustomID]
		if !ok {
			continue
		}
		conds = append(conds, field.And(
			r.q.Account.OrganizationID.Eq(orgUUID),
			r.q.Account.CustomID.Eq(k.customID),
		))
	}

	if len(conds) == 0 {
		// No valid organization custom IDs — all lookups resolve to nil.
		return results, nil
	}

	accounts, err := r.q.Account.WithContext(ctx).Where(field.Or(conds...)).Find()
	if err != nil {
		return nil, fmt.Errorf("batch get accounts: %w", err)
	}

	// Build lookup map from (orgCustomID, customID) -> *model.Account.
	orgCustomIDByUUID := make(map[uuid.UUID]string, len(orgUUIDByCustomID))
	for customID, uid := range orgUUIDByCustomID {
		orgCustomIDByUUID[uid] = customID
	}
	accountByKey := make(map[key]*model.Account, len(accounts))
	for _, a := range accounts {
		orgCustomID := orgCustomIDByUUID[a.OrganizationID]
		k := key{orgCustomID: orgCustomID, customID: a.CustomID}
		accountByKey[k] = a
	}

	// Fill results 1:1 with input.
	for i, l := range lookups {
		k := key{l.OrganizationCustomID, l.AccountCustomID}
		if a, ok := accountByKey[k]; ok {
			results[i] = a
		}
	}

	return results, nil
}

// CreateAccountParams holds the fields required to create an account.
type CreateAccountParams struct {
	OrganizationID     uuid.UUID
	ParentAccountID    uuid.NullUUID
	DisplayName        string
	DisplayCode        string
	DisplayDescription string
	IsContainer        bool
	IsArchived         bool
	CustomID           string
}

// Create inserts a new account.
func (r *AccountRepository) Create(ctx context.Context, params CreateAccountParams) (*model.Account, error) {
	orgCount, err := r.q.Organization.WithContext(ctx).Where(r.q.Organization.ID.Eq(params.OrganizationID)).Count()
	if err != nil {
		return nil, fmt.Errorf("create account: check organization organization_id=%s: %w", params.OrganizationID, err)
	}
	if orgCount == 0 {
		return nil, errors.Join(ErrOrganizationNotFound, fmt.Errorf("organization_id=%s: %w", params.OrganizationID, gorm.ErrRecordNotFound))
	}
	if params.ParentAccountID.Valid {
		parentCount, err := r.q.Account.WithContext(ctx).Where(r.q.Account.ID.Eq(params.ParentAccountID.UUID)).Count()
		if err != nil {
			return nil, fmt.Errorf("create account: check parent account parent_id=%s: %w", params.ParentAccountID.UUID, err)
		}
		if parentCount == 0 {
			return nil, errors.Join(ErrAccountNotFound, fmt.Errorf("parent_id=%s: %w", params.ParentAccountID.UUID, gorm.ErrRecordNotFound))
		}
	}
	m := &model.Account{
		OrganizationID:     params.OrganizationID,
		ParentAccountID:    params.ParentAccountID,
		DisplayName:        params.DisplayName,
		DisplayCode:        params.DisplayCode,
		DisplayDescription: params.DisplayDescription,
		IsContainer:        params.IsContainer,
		IsArchived:         params.IsArchived,
		CustomID:           params.CustomID,
	}
	if err := r.q.Account.WithContext(ctx).Create(m); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, errors.Join(ErrAccountAlreadyExists, fmt.Errorf("organization_id=%s custom_id=%s: %w", m.OrganizationID, m.CustomID, err))
		}
		return nil, fmt.Errorf("create account organization_id=%s custom_id=%s: %w", m.OrganizationID, m.CustomID, err)
	}
	return m, nil
}

// UpdateAccountParams holds the fields that can be updated for an account.
type UpdateAccountParams struct {
	ParentAccountID    optional.Optional[uuid.NullUUID]
	DisplayName        optional.Optional[string]
	DisplayCode        optional.Optional[string]
	DisplayDescription optional.Optional[string]
	IsContainer        optional.Optional[bool]
	IsArchived         optional.Optional[bool]
	CustomID           optional.Optional[string]
}

// Update updates fields of an existing account matched by its primary key.
func (r *AccountRepository) Update(ctx context.Context, id uuid.UUID, params UpdateAccountParams) error {
	var cols []field.AssignExpr

	if params.ParentAccountID.IsSet {
		cols = append(cols, r.q.Account.ParentAccountID.Value(params.ParentAccountID.Value))
	}

	if params.DisplayName.IsSet {
		cols = append(cols, r.q.Account.DisplayName.Value(params.DisplayName.Value))
	}

	if params.DisplayCode.IsSet {
		cols = append(cols, r.q.Account.DisplayCode.Value(params.DisplayCode.Value))
	}

	if params.DisplayDescription.IsSet {
		cols = append(cols, r.q.Account.DisplayDescription.Value(params.DisplayDescription.Value))
	}

	if params.IsContainer.IsSet {
		cols = append(cols, r.q.Account.IsContainer.Value(params.IsContainer.Value))
	}

	if params.IsArchived.IsSet {
		cols = append(cols, r.q.Account.IsArchived.Value(params.IsArchived.Value))
	}

	if params.CustomID.IsSet {
		cols = append(cols, r.q.Account.CustomID.Value(params.CustomID.Value))
	}

	if len(cols) == 0 {
		return nil
	}

	if _, err := r.q.Account.WithContext(ctx).Where(r.q.Account.ID.Eq(id)).UpdateSimple(cols...); err != nil {
		return fmt.Errorf("update account id=%s: %w", id, err)
	}

	return nil
}

// Delete removes the account with the given ID.
func (r *AccountRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.q.Account.WithContext(ctx).Where(r.q.Account.ID.Eq(id)).Delete()
	if err != nil {
		return fmt.Errorf("delete account id=%s: %w", id, err)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrAccountNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}

// HasAncestor reports whether candidateAncestorID appears anywhere in the ancestor
// chain of accountID. Used to detect cycles before reparenting an account.
func (r *AccountRepository) HasAncestor(ctx context.Context, accountID, candidateAncestorID uuid.UUID) (bool, error) {
	type row struct {
		HasCycle bool `gorm:"column:has_cycle"`
	}
	var res row
	err := r.db.WithContext(ctx).Raw(`
WITH RECURSIVE ancestors(id, parent_id) AS (
    SELECT id, parent_account_id FROM accounts WHERE id = ?
    UNION
    SELECT a.id, a.parent_account_id
    FROM accounts a
    JOIN ancestors an ON a.id = an.parent_id
)
SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = ?) AS has_cycle
`, accountID, candidateAncestorID).Scan(&res).Error
	if err != nil {
		return false, fmt.Errorf("has ancestor account_id=%s candidate=%s: %w", accountID, candidateAncestorID, err)
	}
	return res.HasCycle, nil
}

// GetAncestorsByIDs returns the distinct strict ancestors (parent, grandparent,
// …) of the given accounts using a single recursive query, regardless of tree
// depth. The accounts themselves are not part of the result; shared ancestors
// are returned once. Only the columns needed to build resource names and full
// codes are populated (ID, ParentAccountID, CustomID, DisplayCode,
// DisplayName); a parent reference that dangles simply terminates its chain.
func (r *AccountRepository) GetAncestorsByIDs(ctx context.Context, ids []uuid.UUID) ([]*model.Account, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	var ms []*model.Account
	err := r.db.WithContext(ctx).Raw(`
WITH RECURSIVE ancestors(id, parent_account_id, custom_id, display_code, display_name) AS (
    SELECT id, parent_account_id, custom_id, display_code, display_name
    FROM accounts
    WHERE id IN ?
    UNION
    SELECT a.id, a.parent_account_id, a.custom_id, a.display_code, a.display_name
    FROM accounts a
    JOIN ancestors an ON a.id = an.parent_account_id
)
SELECT * FROM ancestors
`, ids).Scan(&ms).Error
	if err != nil {
		return nil, fmt.Errorf("get account ancestors ids=%v: %w", ids, err)
	}
	return ms, nil
}

// HasTransactionAssignments reports whether any transaction_account_assignments
// row references the given account. Used to block creating children under accounts
// that already have direct transaction assignments.
func (r *AccountRepository) HasTransactionAssignments(ctx context.Context, accountID uuid.UUID) (bool, error) {
	count, err := r.q.TransactionAssignment.WithContext(ctx).
		Where(r.q.TransactionAssignment.AccountID.Eq(accountID)).
		Count()
	if err != nil {
		return false, fmt.Errorf("has transaction assignments account_id=%s: %w", accountID, err)
	}
	return count > 0, nil
}

// ListNestedParams drives the ListNested query.
type ListNestedParams struct {
	IsArchived optional.Optional[bool]
}

// ListNested returns accounts for building a hierarchical view.
// If isArchived is set, filters by that status; otherwise returns all accounts.
func (r *AccountRepository) ListNested(ctx context.Context, params ListNestedParams) ([]*model.Account, error) {
	a := r.q.Account.WithContext(ctx)

	if params.IsArchived.IsSet {
		a = a.Where(r.q.Account.IsArchived.Is(params.IsArchived.Value))
	}

	ms, err := a.Find()
	if err != nil {
		return nil, fmt.Errorf("list nested accounts: %w", err)
	}
	return ms, nil
}

// GetSubtree returns the account and all its descendants starting from rootAccountID.
// If isArchived is set, filters by that status; otherwise returns all accounts.
func (r *AccountRepository) GetSubtree(ctx context.Context, rootAccountID uuid.UUID, isArchived optional.Optional[bool]) ([]*model.Account, error) {
	type row struct {
		ID                 uuid.UUID     `gorm:"column:id"`
		ParentAccountID    uuid.NullUUID `gorm:"column:parent_account_id"`
		DisplayName        string        `gorm:"column:display_name"`
		DisplayCode        string        `gorm:"column:display_code"`
		DisplayDescription string        `gorm:"column:display_description"`
		IsContainer        bool          `gorm:"column:is_container"`
		IsArchived         bool          `gorm:"column:is_archived"`
		UpdatedAt          time.Time     `gorm:"column:updated_at"`
		CreatedAt          time.Time     `gorm:"column:created_at"`
	}

	query := `
WITH RECURSIVE descendants(id, parent_account_id, display_name, display_code, display_description, is_container, is_archived, updated_at, created_at) AS (
    SELECT id, parent_account_id, display_name, display_code, display_description, is_container, is_archived, updated_at, created_at
    FROM accounts
    WHERE id = ?
    UNION
    SELECT a.id, a.parent_account_id, a.display_name, a.display_code, a.display_description, a.is_container, a.is_archived, a.updated_at, a.created_at
    FROM accounts a
    JOIN descendants d ON a.parent_account_id = d.id
)
SELECT * FROM descendants`

	var rows []row
	db := r.db.WithContext(ctx).Raw(query, rootAccountID)
	if err := db.Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("get subtree root_id=%s: %w", rootAccountID, err)
	}

	var result []*model.Account
	for _, r := range rows {
		if isArchived.IsSet && r.IsArchived != isArchived.Value {
			continue
		}
		result = append(result, &model.Account{
			ID:                 r.ID,
			ParentAccountID:    r.ParentAccountID,
			DisplayName:        r.DisplayName,
			DisplayCode:        r.DisplayCode,
			DisplayDescription: r.DisplayDescription,
			IsContainer:        r.IsContainer,
			IsArchived:         r.IsArchived,
			UpdatedAt:          r.UpdatedAt,
			CreatedAt:          r.CreatedAt,
		})
	}
	return result, nil
}
