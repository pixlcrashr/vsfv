package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model/dao"
	"gorm.io/gorm"
)

var (
	ErrBudgetActualAccountValueNotFound = errors.New("budget actual account value not found")
)

// ActualAccountValue is a computed (non-persisted) result representing the
// actual monetary value for a single budget account within a budget period.
type ActualAccountValue struct {
	BudgetCustomID  string
	AccountID       uuid.UUID
	AccountCustomID string
	Value           apd.Decimal
}

// budgetActualRow is the raw SQL scan target for the actual-value query.
type budgetActualRow struct {
	AccountID       uuid.UUID   `gorm:"column:account_id"`
	AccountCustomID string      `gorm:"column:account_custom_id"`
	Amount          apd.Decimal `gorm:"column:amount"`
}

// BudgetActualAccountValueRepository computes actual account values from
// transaction assignments whose parent transactions fall within a
// budget's period.
type BudgetActualAccountValueRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewBudgetActualAccountValueRepository creates a new repository backed by db.
func NewBudgetActualAccountValueRepository(db *gorm.DB) *BudgetActualAccountValueRepository {
	return &BudgetActualAccountValueRepository{db: db, q: dao.Use(db)}
}

// assignmentContributionExpr is the sign rule of the budget plan, expressed as
// a per-assignment SQL CASE over the types of the transaction's debit
// and credit ledger accounts (roles: NULL/unmarked=0, liquidity=1, counter=2,
// start account=3). Debit-side role rows × credit-side role columns:
//
//	          credit →  liquidity  counter  start  unmarked
//	  debit ↓
//	  liquidity              0        0      +1      +1
//	  counter                0        0       0      +1
//	  start                 -1        0       0       0
//	  unmarked              -1       -1       0       0
//
// A neutral assignment yields NULL and is excluded from aggregation.
const assignmentContributionExpr = `CASE
        WHEN (COALESCE(dl.type, 0) = 1 AND COALESCE(cl.type, 0) IN (0, 3))
          OR (COALESCE(dl.type, 0) = 2 AND COALESCE(cl.type, 0) = 0)
            THEN taa.value
        WHEN (COALESCE(dl.type, 0) = 0 AND COALESCE(cl.type, 0) IN (1, 2))
          OR (COALESCE(dl.type, 0) = 3 AND COALESCE(cl.type, 0) = 1)
            THEN -taa.value
        ELSE NULL
    END`

// assignmentContributionJoin is the shared FROM/JOIN clause pairing each
// assignment's transaction with both of its ledger account sides.
const assignmentContributionJoins = `FROM transaction_assignments taa
JOIN transactions t ON t.id = taa.transaction_id
JOIN ledger_accounts cl ON cl.id = t.credit_ledger_account_id
JOIN ledger_accounts dl ON dl.id = t.debit_ledger_account_id
JOIN accounts a ON a.id = taa.account_id`

// ListByBudget computes the actual values for every account that has
// plan-relevant assignments within the given budget's period.
//
// The contribution sign follows the assignment rule documented on
// assignmentContributionExpr: the budget plan measures value crossing between
// the organization's disposal (liquidity, receivable/payable and
// opening-balance accounts) and its income/expense side, so e.g. a payment
// from bank to an expense account counts negatively while a refund on the
// same budget account counts positively, netting correctly.
func (r *BudgetActualAccountValueRepository) ListByBudget(
	ctx context.Context,
	organizationID uuid.UUID,
	periodStart,
	periodEnd time.Time,
) ([]*ActualAccountValue, error) {
	query := `
WITH assignment_values AS (
    SELECT
        taa.account_id,
        a.custom_id AS account_custom_id,
        ` + assignmentContributionExpr + ` AS contribution
    ` + assignmentContributionJoins + `
    WHERE t.organization_id = ?
      AND t.document_date >= ?
      AND t.document_date <= ?
)
SELECT
    account_id,
    account_custom_id,
    SUM(contribution) AS amount
FROM assignment_values
WHERE contribution IS NOT NULL
GROUP BY account_id, account_custom_id
ORDER BY account_id
`

	var rows []budgetActualRow
	if err := r.db.WithContext(ctx).Raw(query,
		organizationID, periodStart, periodEnd,
	).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("list budget actual account values: %w", err)
	}

	result := make([]*ActualAccountValue, 0, len(rows))
	for _, row := range rows {
		v := &ActualAccountValue{
			AccountID:       row.AccountID,
			AccountCustomID: row.AccountCustomID,
		}
		v.Value.Set(&row.Amount)
		result = append(result, v)
	}

	return result, nil
}

// GetByBudgetAndAccount computes the actual value for a single account within
// a budget period.
//
// Uses the same assignment rule as ListByBudget.
func (r *BudgetActualAccountValueRepository) GetByBudgetAndAccount(
	ctx context.Context,
	organizationID uuid.UUID,
	periodStart, periodEnd time.Time,
	accountCustomID string,
) (*ActualAccountValue, error) {
	query := `
WITH assignment_values AS (
    SELECT
        taa.account_id,
        a.custom_id AS account_custom_id,
        ` + assignmentContributionExpr + ` AS contribution
    ` + assignmentContributionJoins + `
    WHERE t.organization_id = ?
      AND t.document_date >= ?
      AND t.document_date <= ?
      AND a.custom_id = ?
)
SELECT
    account_id,
    account_custom_id,
    SUM(contribution) AS amount
FROM assignment_values
WHERE contribution IS NOT NULL
GROUP BY account_id, account_custom_id
`

	var row budgetActualRow
	if err := r.db.WithContext(ctx).Raw(query,
		organizationID, periodStart, periodEnd, accountCustomID,
	).Scan(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrBudgetActualAccountValueNotFound
		}
		return nil, fmt.Errorf("get budget actual account value: %w", err)
	}

	// Check if we got a valid result (amount will be NULL if no rows)
	if row.AccountID == uuid.Nil {
		return nil, ErrBudgetActualAccountValueNotFound
	}

	return &ActualAccountValue{
		AccountID:       row.AccountID,
		AccountCustomID: row.AccountCustomID,
		Value:           row.Amount,
	}, nil
}

// budgetActualMultiRow is the raw SQL scan target for the multi-budget
// actual-value query.
type budgetActualMultiRow struct {
	BudgetCustomID  string      `gorm:"column:budget_custom_id"`
	AccountID       uuid.UUID   `gorm:"column:account_id"`
	AccountCustomID string      `gorm:"column:account_custom_id"`
	Amount          apd.Decimal `gorm:"column:amount"`
}

// ListByBudgets computes the actual values for every account that has
// plan-relevant assignments within the requested budgets' periods. An optional
// document_date range can further restrict the transactions that are summed.
//
// Uses the same assignment rule as ListByBudget.
func (r *BudgetActualAccountValueRepository) ListByBudgets(
	ctx context.Context,
	organizationID uuid.UUID,
	budgetCustomIDs []string,
	documentDateFrom,
	documentDateTo *time.Time,
) ([]*ActualAccountValue, error) {
	query := `
WITH assignment_values AS (
    SELECT
        b.custom_id AS budget_custom_id,
        a.id AS account_id,
        a.custom_id AS account_custom_id,
        ` + assignmentContributionExpr + ` AS contribution
    ` + assignmentContributionJoins + `
    JOIN budgets b ON b.organization_id = ? AND t.document_date >= b.period_start AND t.document_date <= b.period_end
    WHERE t.organization_id = ?
      AND b.organization_id = ?
`
	args := []interface{}{organizationID, organizationID, organizationID}

	if len(budgetCustomIDs) > 0 {
		query += "      AND b.custom_id IN ?\n"
		args = append(args, budgetCustomIDs)
	}
	if documentDateFrom != nil {
		query += "      AND t.document_date >= ?\n"
		args = append(args, *documentDateFrom)
	}
	if documentDateTo != nil {
		query += "      AND t.document_date <= ?\n"
		args = append(args, *documentDateTo)
	}

	query += `
)
SELECT
    budget_custom_id,
    account_id,
    account_custom_id,
    SUM(contribution) AS amount
FROM assignment_values
WHERE contribution IS NOT NULL
GROUP BY budget_custom_id, account_id, account_custom_id
ORDER BY budget_custom_id, account_custom_id
`

	var rows []budgetActualMultiRow
	if err := r.db.WithContext(ctx).Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("list budget actual account values: %w", err)
	}

	result := make([]*ActualAccountValue, 0, len(rows))
	for _, row := range rows {
		v := &ActualAccountValue{
			BudgetCustomID:  row.BudgetCustomID,
			AccountID:       row.AccountID,
			AccountCustomID: row.AccountCustomID,
		}
		v.Value.Set(&row.Amount)
		result = append(result, v)
	}

	return result, nil
}
