package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"github.com/pixlcrashr/go-pagetoken"
	"github.com/pixlcrashr/go-pagetoken/order"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/model/dao"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/theater-improrama/go-utils/optional"
	"gorm.io/gen/field"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrTransactionNotFound      = errors.New("transaction not found")
	ErrTransactionAlreadyExists = errors.New("transaction already exists")
)

// ListTransactionsParams drives the List query with keyset pagination.
type ListTransactionsParams struct {
	// Cond is an optional abstract condition chain (AND/OR/NOT support).
	Cond cond.Cond
	// KeysetValues for keyset pagination cursor.
	KeysetValues []pagetoken.KeysetValue
	// PageSize caps the number of rows returned.
	PageSize int
	// Offset skips the first N rows (used for offset-based pagination).
	Offset int
	// AssignmentStatus filters by derived assignment status: "open",
	// "assigned", or "partial". Empty means no status filter.
	AssignmentStatus string
}

// transactionColumnMapper maps filter field names to database column names.
func transactionColumnMapper(field string) (string, bool) {
	switch field {
	case "credit_ledger_account":
		return "credit_ledger_account_id", true
	case "debit_ledger_account":
		return "debit_ledger_account_id", true
	case "booked_at":
		return "booked_at", true
	default:
		return "", false
	}
}

// TransactionRepository provides CRUD and specialised queries for the transactions table.
type TransactionRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewTransactionRepository creates a TransactionRepository backed by db.
func NewTransactionRepository(db *gorm.DB) *TransactionRepository {
	return &TransactionRepository{db: db, q: dao.Use(db)}
}

// fieldToExpr converts a keyset field to a GORM clause expression.
func (r *TransactionRepository) fieldToExpr(field string, value string, op int) (clause.Expression, error) {
	var v any

	switch field {
	case "id":
		id, err := uuid.Parse(value)
		if err != nil {
			return nil, err
		}
		v = id
	case "booked_at":
		t, err := time.Parse(time.RFC3339Nano, value)
		if err != nil {
			return nil, err
		}
		v = t
	case "created_at":
		t, err := time.Parse(time.RFC3339Nano, value)
		if err != nil {
			return nil, err
		}
		v = t
	default:
		return nil, fmt.Errorf("unknown field %q", field)
	}

	switch op {
	case 0: // Eq
		return clause.Eq{Column: field, Value: v}, nil
	case 1: // Lt
		return clause.Lt{Column: field, Value: v}, nil
	case 2: // Gt
		return clause.Gt{Column: field, Value: v}, nil
	default:
		return nil, fmt.Errorf("unknown op %d", op)
	}
}

// assignmentStatusWhere returns a raw WHERE clause that filters transactions by
// their derived assignment status, or "" if no status filter is set.
// Status values: "open" (no assignments), "assigned" (sum >= amount), "partial"
// (sum < amount). Any other value matches nothing.
func assignmentStatusWhere(status string) (string, []interface{}) {
	if status == "" {
		return "", nil
	}
	return "CASE " +
		"WHEN NOT EXISTS (SELECT 1 FROM transaction_assignments ta WHERE ta.transaction_id = transactions.id) THEN 'open' " +
		"WHEN (SELECT COALESCE(SUM(ta.value), 0) FROM transaction_assignments ta WHERE ta.transaction_id = transactions.id) >= transactions.amount THEN 'assigned' " +
		"ELSE 'partial' " +
		"END = ?", []interface{}{status}
}

// List returns transactions matching params using keyset pagination.
func (r *TransactionRepository) List(ctx context.Context, params ListTransactionsParams) ([]*model.Transaction_, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}

	// When condition chain is present, use raw GORM
	if params.Cond != nil && !params.Cond.IsEmpty() {
		db := r.db.WithContext(ctx).Table("transactions")
		db = cond.Apply(db, params.Cond, transactionColumnMapper)
		if sql, args := assignmentStatusWhere(params.AssignmentStatus); sql != "" {
			db = db.Where(sql, args...)
		}

		// Apply default ordering if no keyset
		if len(params.KeysetValues) == 0 {
			db = db.Order("booked_at DESC, id DESC")
		}

		if params.Offset > 0 {
			db = db.Offset(params.Offset)
		}
		db = db.Limit(params.PageSize)

		var ms []*model.Transaction_
		if err := db.Find(&ms).Error; err != nil {
			return nil, fmt.Errorf("list transactions: %w", err)
		}
		return ms, nil
	}

	t := r.q.Transaction_.WithContext(ctx)
	if sql, args := assignmentStatusWhere(params.AssignmentStatus); sql != "" {
		t = t.Clauses(clause.Expr{SQL: sql, Vars: args})
	}

	// Apply keyset cursor if present
	if len(params.KeysetValues) > 0 {
		// Build keyset WHERE clause
		var orClauses []clause.Expression
		for i := 0; i < len(params.KeysetValues); i++ {
			var andClauses []clause.Expression

			// Equality conditions for all preceding fields
			for j := 0; j < i; j++ {
				f := params.KeysetValues[j]
				expr, err := r.fieldToExpr(f.Path, f.Value, 0) // Eq
				if err != nil {
					return nil, err
				}
				andClauses = append(andClauses, expr)
			}

			// Inequality condition for current field based on order
			f := params.KeysetValues[i]
			var op int
			if f.Order == order.Desc {
				op = 1 // Lt
			} else {
				op = 2 // Gt
			}
			expr, err := r.fieldToExpr(f.Path, f.Value, op)
			if err != nil {
				return nil, err
			}
			andClauses = append(andClauses, expr)

			if len(andClauses) == 1 {
				orClauses = append(orClauses, andClauses[0])
			} else {
				orClauses = append(orClauses, clause.And(andClauses...))
			}
		}

		if len(orClauses) > 0 {
			t = t.Clauses(clause.Where{
				Exprs: []clause.Expression{clause.Or(orClauses...)},
			})
		}
	}

	// Apply ordering based on keyset fields
	for _, f := range params.KeysetValues {
		field, ok := r.q.Transaction_.GetFieldByName(f.Path)
		if !ok {
			return nil, fmt.Errorf("unknown field %q", f.Path)
		}

		if f.Order == order.Desc {
			t = t.Order(field.Desc())
		} else {
			t = t.Order(field.Asc())
		}
	}

	// Default ordering if no keyset fields
	if len(params.KeysetValues) == 0 {
		t = t.Order(r.q.Transaction_.BookedAt.Desc(), r.q.Transaction_.ID.Desc())
	}

	if params.Offset > 0 {
		t = t.Offset(params.Offset)
	}
	t = t.Limit(params.PageSize)

	ms, err := t.Find()
	if err != nil {
		return nil, fmt.Errorf("list transactions: %w", err)
	}

	return ms, nil
}

// Count returns the total number of transactions matching params.Cond without
// pagination; it is used to populate the total_size of list responses.
func (r *TransactionRepository) Count(ctx context.Context, params ListTransactionsParams) (int64, error) {
	if params.Cond != nil && !params.Cond.IsEmpty() {
		db := r.db.WithContext(ctx).Table("transactions")
		db = cond.Apply(db, params.Cond, transactionColumnMapper)
		if sql, args := assignmentStatusWhere(params.AssignmentStatus); sql != "" {
			db = db.Where(sql, args...)
		}

		var total int64
		if err := db.Count(&total).Error; err != nil {
			return 0, fmt.Errorf("count transactions: %w", err)
		}
		return total, nil
	}

	t := r.q.Transaction_.WithContext(ctx)
	if sql, args := assignmentStatusWhere(params.AssignmentStatus); sql != "" {
		t = t.Clauses(clause.Expr{SQL: sql, Vars: args})
	}
	total, err := t.Count()
	if err != nil {
		return 0, fmt.Errorf("count transactions: %w", err)
	}
	return total, nil
}

// GetByID returns the transaction with the given ID.
func (r *TransactionRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Transaction_, error) {
	m, err := r.q.Transaction_.WithContext(ctx).Where(r.q.Transaction_.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrTransactionNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get transaction id=%s: %w", id, err)
	}
	return m, nil
}

// GetByCustomID returns the transaction with the given custom ID within an organization.
func (r *TransactionRepository) GetByCustomID(ctx context.Context, orgID uuid.UUID, customID string) (*model.Transaction_, error) {
	m, err := r.q.Transaction_.WithContext(ctx).Where(
		r.q.Transaction_.OrganizationID.Eq(orgID),
		r.q.Transaction_.CustomID.Eq(customID),
	).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrTransactionNotFound, fmt.Errorf("organization_id=%s custom_id=%s: %w", orgID, customID, err))
		}
		return nil, fmt.Errorf("get transaction organization_id=%s custom_id=%s: %w", orgID, customID, err)
	}
	return m, nil
}

// TransactionResourceNameLookup identifies a transaction by its organization
// custom ID and transaction custom ID — the two segments of a Transaction
// resource name.
type TransactionResourceNameLookup struct {
	OrganizationCustomID string
	TransactionCustomID  string
}

// BatchGetByResourceName resolves a list of transaction resource name lookups
// to their model entities in a minimal number of queries. The returned slice
// is 1:1 with the input: each element is either the matching *model.Transaction_
// or nil if no transaction exists for that lookup. Duplicate lookups are
// handled correctly (each position gets its own pointer).
//
// The underlying query uses a single SELECT with chained OR tuples built via
// the generated DAO:
//
//	WHERE (organization_id = ? AND custom_id = ?)
//	   OR (organization_id = ? AND custom_id = ?)
//	   OR ...
func (r *TransactionRepository) BatchGetByResourceName(ctx context.Context, lookups []TransactionResourceNameLookup) ([]*model.Transaction_, error) {
	results := make([]*model.Transaction_, len(lookups))
	if len(lookups) == 0 {
		return results, nil
	}

	// Collect unique (orgCustomID, txCustomID) pairs to query once.
	type key struct {
		orgCustomID string
		customID    string
	}
	uniqueKeys := make([]key, 0, len(lookups))
	seen := make(map[key]struct{}, len(lookups))
	for _, l := range lookups {
		k := key{l.OrganizationCustomID, l.TransactionCustomID}
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
		return nil, fmt.Errorf("batch get transactions: list organizations: %w", err)
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
			r.q.Transaction_.OrganizationID.Eq(orgUUID),
			r.q.Transaction_.CustomID.Eq(k.customID),
		))
	}

	if len(conds) == 0 {
		// No valid organization custom IDs — all lookups resolve to nil.
		return results, nil
	}

	txns, err := r.q.Transaction_.WithContext(ctx).Where(field.Or(conds...)).Find()
	if err != nil {
		return nil, fmt.Errorf("batch get transactions: %w", err)
	}

	// Build lookup map from (orgCustomID, txCustomID) -> *model.Transaction_.
	orgCustomIDByUUID := make(map[uuid.UUID]string, len(orgUUIDByCustomID))
	for customID, uid := range orgUUIDByCustomID {
		orgCustomIDByUUID[uid] = customID
	}
	txnByKey := make(map[key]*model.Transaction_, len(txns))
	for _, t := range txns {
		orgCustomID := orgCustomIDByUUID[t.OrganizationID]
		k := key{orgCustomID: orgCustomID, customID: t.CustomID}
		txnByKey[k] = t
	}

	// Fill results 1:1 with input.
	for i, l := range lookups {
		k := key{l.OrganizationCustomID, l.TransactionCustomID}
		if t, ok := txnByKey[k]; ok {
			results[i] = t
		}
	}

	return results, nil
}

// ListByIDs returns transactions matching the given IDs. If no IDs are given,
// returns an empty slice.
func (r *TransactionRepository) ListByIDs(ctx context.Context, ids []uuid.UUID) ([]*model.Transaction_, error) {
	if len(ids) == 0 {
		return []*model.Transaction_{}, nil
	}
	var ms []*model.Transaction_
	if err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&ms).Error; err != nil {
		return nil, fmt.Errorf("list transactions by ids: %w", err)
	}
	return ms, nil
}

// CreateTransactionParams holds the fields required to create a transaction.
//
// CustomID is not accepted here: a transaction's custom_id is always its
// primary key id (enforced by the model's BeforeCreate hook). The
// JournalKey (the deterministic cross-journal dedup identifier) is computed
// inside Create from the ledger account codes and the transaction fields.
type CreateTransactionParams struct {
	OrganizationID        uuid.UUID
	CreditLedgerAccountID uuid.UUID
	DebitLedgerAccountID  uuid.UUID
	Amount                apd.Decimal
	Description           string
	Reference             string
	BookedAt              time.Time
	DocumentDate          time.Time
}

// Create inserts a new transaction.
func (r *TransactionRepository) Create(ctx context.Context, params CreateTransactionParams) (*model.Transaction_, error) {
	creditLA, err := r.q.LedgerAccount.WithContext(ctx).Where(r.q.LedgerAccount.ID.Eq(params.CreditLedgerAccountID)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrLedgerAccountNotFound, fmt.Errorf("credit_ledger_account_id=%s: %w", params.CreditLedgerAccountID, err))
		}
		return nil, fmt.Errorf("create transaction: check credit account credit_ledger_account_id=%s: %w", params.CreditLedgerAccountID, err)
	}
	debitLA, err := r.q.LedgerAccount.WithContext(ctx).Where(r.q.LedgerAccount.ID.Eq(params.DebitLedgerAccountID)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrLedgerAccountNotFound, fmt.Errorf("debit_ledger_account_id=%s: %w", params.DebitLedgerAccountID, err))
		}
		return nil, fmt.Errorf("create transaction: check debit account debit_ledger_account_id=%s: %w", params.DebitLedgerAccountID, err)
	}
	journalKey := model.ComputeTransactionJournalKey(
		params.BookedAt, params.DocumentDate,
		creditLA.Code, debitLA.Code,
		params.Amount, params.Reference, params.Description,
	)
	m := &model.Transaction_{
		OrganizationID:        params.OrganizationID,
		CreditLedgerAccountID: params.CreditLedgerAccountID,
		DebitLedgerAccountID:  params.DebitLedgerAccountID,
		Amount:                params.Amount,
		Description:           params.Description,
		Reference:             params.Reference,
		BookedAt:              params.BookedAt,
		DocumentDate:          params.DocumentDate,
		JournalKey:            journalKey,
	}
	if err := r.q.Transaction_.WithContext(ctx).Create(m); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, errors.Join(ErrTransactionAlreadyExists, fmt.Errorf("journal_key=%s: %w", m.JournalKey, err))
		}
		return nil, fmt.Errorf("create transaction: %w", err)
	}
	return m, nil
}

// UpdateTransactionParams holds the fields that can be updated for a transaction.
//
// CustomID is not updatable: it always equals the transaction's primary key id.
// The JournalKey is recomputed inside Update from the merged field values and
// the credit/debit ledger account codes, so it is not a parameter either.
type UpdateTransactionParams struct {
	CreditLedgerAccountID optional.Optional[uuid.UUID]
	DebitLedgerAccountID  optional.Optional[uuid.UUID]
	Amount                optional.Optional[apd.Decimal]
	Description           optional.Optional[string]
	Reference             optional.Optional[string]
	BookedAt              optional.Optional[time.Time]
	DocumentDate          optional.Optional[time.Time]
}

// Update updates fields of an existing transaction matched by its primary key.
// The JournalKey is recomputed from the post-update field values and the
// credit/debit ledger account codes so it stays consistent with the stored
// data.
func (r *TransactionRepository) Update(ctx context.Context, id uuid.UUID, params UpdateTransactionParams) error {
	var cols []field.AssignExpr

	if params.CreditLedgerAccountID.IsSet {
		cols = append(cols, r.q.Transaction_.CreditLedgerAccountID.Value(params.CreditLedgerAccountID.Value))
	}

	if params.DebitLedgerAccountID.IsSet {
		cols = append(cols, r.q.Transaction_.DebitLedgerAccountID.Value(params.DebitLedgerAccountID.Value))
	}

	if params.Amount.IsSet {
		cols = append(cols, r.q.Transaction_.Amount.Value(params.Amount.Value))
	}

	if params.Description.IsSet {
		cols = append(cols, r.q.Transaction_.Description.Value(params.Description.Value))
	}

	if params.Reference.IsSet {
		cols = append(cols, r.q.Transaction_.Reference.Value(params.Reference.Value))
	}

	if params.BookedAt.IsSet {
		cols = append(cols, r.q.Transaction_.BookedAt.Value(params.BookedAt.Value))
	}

	if params.DocumentDate.IsSet {
		cols = append(cols, r.q.Transaction_.DocumentDate.Value(params.DocumentDate.Value))
	}

	if len(cols) == 0 {
		return nil
	}

	// Recompute the JournalKey from the merged state of the transaction. Load
	// the current row to obtain the fields that are not being updated, then
	// apply the optional updates and fetch the credit/debit ledger account
	// codes.
	existing, err := r.q.Transaction_.WithContext(ctx).Where(r.q.Transaction_.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.Join(ErrTransactionNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return fmt.Errorf("update transaction id=%s: load existing: %w", id, err)
	}

	creditID := existing.CreditLedgerAccountID
	if params.CreditLedgerAccountID.IsSet {
		creditID = params.CreditLedgerAccountID.Value
	}
	debitID := existing.DebitLedgerAccountID
	if params.DebitLedgerAccountID.IsSet {
		debitID = params.DebitLedgerAccountID.Value
	}
	creditLA, err := r.q.LedgerAccount.WithContext(ctx).Where(r.q.LedgerAccount.ID.Eq(creditID)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.Join(ErrLedgerAccountNotFound, fmt.Errorf("credit_ledger_account_id=%s: %w", creditID, err))
		}
		return fmt.Errorf("update transaction id=%s: load credit ledger account: %w", id, err)
	}
	debitLA, err := r.q.LedgerAccount.WithContext(ctx).Where(r.q.LedgerAccount.ID.Eq(debitID)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.Join(ErrLedgerAccountNotFound, fmt.Errorf("debit_ledger_account_id=%s: %w", debitID, err))
		}
		return fmt.Errorf("update transaction id=%s: load debit ledger account: %w", id, err)
	}

	amount := existing.Amount
	if params.Amount.IsSet {
		amount = params.Amount.Value
	}
	description := existing.Description
	if params.Description.IsSet {
		description = params.Description.Value
	}
	reference := existing.Reference
	if params.Reference.IsSet {
		reference = params.Reference.Value
	}
	bookedAt := existing.BookedAt
	if params.BookedAt.IsSet {
		bookedAt = params.BookedAt.Value
	}
	documentDate := existing.DocumentDate
	if params.DocumentDate.IsSet {
		documentDate = params.DocumentDate.Value
	}

	journalKey := model.ComputeTransactionJournalKey(
		bookedAt, documentDate,
		creditLA.Code, debitLA.Code,
		amount, reference, description,
	)
	cols = append(cols, r.q.Transaction_.JournalKey.Value(journalKey))

	if _, err := r.q.Transaction_.WithContext(ctx).Where(r.q.Transaction_.ID.Eq(id)).UpdateSimple(cols...); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return errors.Join(ErrTransactionAlreadyExists, fmt.Errorf("journal_key=%s: %w", journalKey, err))
		}
		return fmt.Errorf("update transaction id=%s: %w", id, err)
	}

	return nil
}

// Delete removes the transaction with the given ID.
func (r *TransactionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.q.Transaction_.WithContext(ctx).Where(r.q.Transaction_.ID.Eq(id)).Delete()
	if err != nil {
		return fmt.Errorf("delete transaction id=%s: %w", id, err)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrTransactionNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}
