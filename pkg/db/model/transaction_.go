package model

import (
	"strings"
	"time"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TransactionJournalKeyVersion is the version prefix used when constructing a
// transaction's JournalKey. Bumping this produces a new key namespace, which is
// useful if the key composition changes in an incompatible way.
const TransactionJournalKeyVersion = "v1"

// Transaction_ has suffix due to naming conflicts when using Gorm DAOs.
type Transaction_ struct {
	ID                    uuid.UUID   `gorm:"type:uuid;primaryKey;uniqueIndex:idx_transactions_org_id,priority:1"`
	CustomID              string      `gorm:"uniqueIndex:idx_transactions_custom_id_org,priority:1"`
	JournalKey            string      `gorm:"not null;uniqueIndex:idx_transactions_journal_key_org,priority:1"`
	OrganizationID        uuid.UUID   `gorm:"type:uuid;not null;uniqueIndex:idx_transactions_org_id,priority:2;uniqueIndex:idx_transactions_custom_id_org,priority:2;uniqueIndex:idx_transactions_journal_key_org,priority:2"`
	CreditLedgerAccountID uuid.UUID   `gorm:"type:uuid;not null;uniqueIndex:idx_transactions_unique_entry,priority:1"`
	DebitLedgerAccountID  uuid.UUID   `gorm:"type:uuid;not null;uniqueIndex:idx_transactions_unique_entry,priority:2"`
	Amount                apd.Decimal `gorm:"type:decimal;not null;uniqueIndex:idx_transactions_unique_entry,priority:3"`
	Description           string      `gorm:"not null;default:'';uniqueIndex:idx_transactions_unique_entry,priority:4"`
	Reference             string      `gorm:"not null;default:'';uniqueIndex:idx_transactions_unique_entry,priority:5"`
	BookedAt              time.Time   `gorm:"type:date;not null;default:CURRENT_TIMESTAMP;uniqueIndex:idx_transactions_unique_entry,priority:6"`
	DocumentDate          time.Time   `gorm:"type:date;not null;default:CURRENT_TIMESTAMP;uniqueIndex:idx_transactions_unique_entry,priority:7"`
	UpdatedAt             time.Time   `gorm:"not null;default:CURRENT_TIMESTAMP"`
	CreatedAt             time.Time   `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	Organization           Organization            `gorm:"foreignKey:OrganizationID"`
	CreditLedgerAccount    LedgerAccount           `gorm:"foreignKey:CreditLedgerAccountID"`
	DebitLedgerAccount     LedgerAccount           `gorm:"foreignKey:DebitLedgerAccountID"`
	TransactionAssignments []TransactionAssignment `gorm:"foreignKey:TransactionID"`
}

func (Transaction_) TableName() string { return "transactions" }

func (m *Transaction_) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}

	// Transactions are not addressable by a user-supplied custom_id; the
	// custom_id is always the primary key id. This keeps the resource name
	// (which uses the id) and the custom_id in sync and prevents imports from
	// assigning wrong/garbage custom ids.
	m.CustomID = m.ID.String()

	return nil
}

func (m *Transaction_) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}

// ComputeTransactionJournalKey builds the deterministic identifier used to
// deduplicate transactions across different journal files. The format is:
//
//	v1:booked_at:document_date:credit_code:debit_code:amount:reference:description
//
// where booked_at/document_date are YYYY-MM-DD, credit_code/debit_code are the
// code of the credit/debit ledger account, and amount is the decimal string
// with trailing zeros and a trailing decimal point stripped (e.g. 500.00 ->
// 500).
func ComputeTransactionJournalKey(
	bookedAt, documentDate time.Time,
	creditCode, debitCode string,
	amount apd.Decimal,
	reference, description string,
) string {
	return strings.Join([]string{
		TransactionJournalKeyVersion,
		bookedAt.Format("2006-01-02"),
		documentDate.Format("2006-01-02"),
		creditCode,
		debitCode,
		trimDecimalZeros(amount.String()),
		reference,
		description,
	}, ":")
}

// trimDecimalZeros removes trailing zeros and a trailing decimal point from a
// decimal string (e.g. "500.00" -> "500", "18.50" -> "18.5", "100" -> "100").
func trimDecimalZeros(s string) string {
	if !strings.Contains(s, ".") {
		return s
	}
	s = strings.TrimRight(s, "0")
	s = strings.TrimRight(s, ".")
	return s
}
