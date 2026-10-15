package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Account struct {
	ID                 uuid.UUID     `gorm:"type:uuid;primaryKey;uniqueIndex:idx_accounts_org_id,priority:1"`
	CustomID           string        `gorm:"uniqueIndex:idx_accounts_custom_id_org,priority:1"`
	OrganizationID     uuid.UUID     `gorm:"type:uuid;not null;uniqueIndex:idx_accounts_org_id,priority:2;uniqueIndex:idx_accounts_custom_id_org,priority:2"`
	ParentAccountID    uuid.NullUUID `gorm:"type:uuid;index:idx_accounts_parent_account_id"`
	DisplayName        string        `gorm:"not null;default:'';index:idx_accounts_display_name"`
	DisplayCode        string        `gorm:"not null;default:'';index:idx_accounts_display_code"`
	DisplayDescription string        `gorm:"not null;default:''"`
	IsContainer        bool          `gorm:"not null;default:false;index:idx_accounts_is_container"`
	InvertSign         bool          `gorm:"not null;default:false"`
	IsArchived         bool          `gorm:"not null;default:false"`
	UpdatedAt          time.Time     `gorm:"not null;default:CURRENT_TIMESTAMP"`
	CreatedAt          time.Time     `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	Organization                Organization                 `gorm:"foreignKey:OrganizationID"`
	ParentAccount               *Account                     `gorm:"foreignKey:ParentAccountID"`
	ChildAccounts               []Account                    `gorm:"foreignKey:ParentAccountID"`
	AccountGroupAssignments     []AccountGroupAssignment     `gorm:"foreignKey:AccountID"`
	BudgetRevisionAccountValues []BudgetRevisionAccountValue `gorm:"foreignKey:AccountID"`
	BudgetAccountValues         []BudgetAccountValue         `gorm:"foreignKey:AccountID"`
	TransactionAssignments      []TransactionAssignment      `gorm:"foreignKey:AccountID"`
}

func (Account) TableName() string { return "accounts" }

func (m *Account) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}

	if m.CustomID == "" {
		m.CustomID = m.ID.String()
	}

	return nil
}

func (m *Account) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
