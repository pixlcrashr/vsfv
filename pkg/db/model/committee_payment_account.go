package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CommitteePaymentAccount is a payment account held by a committee (e.g. the
// committee's own bank account or an independently organized cash box). The
// primary key doubles as the public uid that submissions reference.
type CommitteePaymentAccount struct {
	ID           uuid.UUID          `gorm:"type:uuid;primaryKey"`
	CommitteeID  uuid.UUID          `gorm:"type:uuid;not null;index:idx_committee_payment_accounts_committee_id"`
	Kind         PaymentAccountKind `gorm:"type:int;not null;default:0"`
	DisplayLabel string             `gorm:"not null;default:''"`
	CreatedAt    time.Time          `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	Committee Committee `gorm:"foreignKey:CommitteeID"`
}

func (CommitteePaymentAccount) TableName() string { return "committee_payment_accounts" }

func (m *CommitteePaymentAccount) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

func (m *CommitteePaymentAccount) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
