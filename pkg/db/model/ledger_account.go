package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// LedgerAccountType mirrors the proto LedgerAccountType enum. It classifies
// ledger accounts for the budget-plan actual-value computation; unmarked
// (NULL) accounts are plain income/expense-side accounts. Bank/cash accounts
// are liquidity, real receivables/payables (Debitoren, Darlehen, Kreditoren)
// are counter accounts and opening-balance accounts are start accounts.
type LedgerAccountType int

const (
	LedgerAccountTypeLiquidity LedgerAccountType = iota + 1
	LedgerAccountTypeCounter
	LedgerAccountTypeStartAccount
)

type LedgerAccount struct {
	ID                 uuid.UUID          `gorm:"type:uuid;primaryKey;uniqueIndex:idx_ledger_accounts_org_id,priority:1"`
	CustomID           string             `gorm:"uniqueIndex:idx_ledger_accounts_custom_id,priority:1"`
	OrganizationID     uuid.UUID          `gorm:"type:uuid;not null;uniqueIndex:idx_ledger_accounts_org_id,priority:2;uniqueIndex:idx_ledger_accounts_org_code,priority:1;uniqueIndex:idx_ledger_accounts_custom_id,priority:2"`
	Code               string             `gorm:"type:varchar(64);not null;uniqueIndex:idx_ledger_accounts_org_code,priority:2;index:idx_ledger_accounts_code"`
	Type               *LedgerAccountType `gorm:"type:int"`
	DisplayName        string      `gorm:"not null;default:'';index:idx_ledger_accounts_display_name"`
	DisplayDescription string      `gorm:"not null;default:''"`
	UpdatedAt          time.Time   `gorm:"not null;default:CURRENT_TIMESTAMP"`
	CreatedAt          time.Time   `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	Organization       Organization   `gorm:"foreignKey:OrganizationID"`
	CreditTransactions []Transaction_ `gorm:"foreignKey:CreditLedgerAccountID"`
	DebitTransactions  []Transaction_ `gorm:"foreignKey:DebitLedgerAccountID"`
}

func (LedgerAccount) TableName() string { return "ledger_accounts" }

func (m *LedgerAccount) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}

	if m.CustomID == "" {
		m.CustomID = m.ID.String()
	}

	return nil
}

func (m *LedgerAccount) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
