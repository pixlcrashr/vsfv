package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PaymentAccountKind mirrors the proto PaymentAccountKind enum.
type PaymentAccountKind int

const (
	PaymentAccountKindUnspecified PaymentAccountKind = iota
	PaymentAccountKindBankAccount
	PaymentAccountKindCashBox
)

// Committee is an organizational unit (e.g. a student committee) that
// submits expense submissions and income documents.
type Committee struct {
	ID                  uuid.UUID `gorm:"type:uuid;primaryKey;uniqueIndex:idx_committees_org_id,priority:1"`
	CustomID            string    `gorm:"not null;uniqueIndex:idx_committees_org_custom_id,priority:1"`
	OrganizationID      uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_committees_org_id,priority:2;uniqueIndex:idx_committees_org_custom_id,priority:2"`
	DisplayName         string    `gorm:"not null;default:'';index:idx_committees_display_name"`
	DisplayDescription  string    `gorm:"not null;default:''"`
	AllowScopeSelection bool      `gorm:"not null;default:false"`
	CreatedAt           time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`
	UpdatedAt           time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	Organization    Organization              `gorm:"foreignKey:OrganizationID"`
	PaymentAccounts []CommitteePaymentAccount `gorm:"foreignKey:CommitteeID"`
	Submissions     []Submission              `gorm:"foreignKey:CommitteeID"`
}

func (Committee) TableName() string { return "committees" }

func (m *Committee) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}

	if m.CustomID == "" {
		m.CustomID = m.ID.String()
	}

	return nil
}

func (m *Committee) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
