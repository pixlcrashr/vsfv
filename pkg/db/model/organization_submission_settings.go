package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/types"
	"gorm.io/gorm"
)

// OrganizationSubmissionSettings holds the per-organization submission
// configuration as typed columns (1:1 with an organization, following the
// UserSettings pattern). A missing row means default settings.
//
// EnabledSettlementKinds stores the settlement enum *names* (e.g. "PERSON",
// "COMMITTEE_ACCOUNT", "PAYMENT_REQUEST"); an empty list means "all kinds
// enabled".
type OrganizationSubmissionSettings struct {
	ID                     uuid.UUID         `gorm:"type:uuid;primaryKey"`
	OrganizationID         uuid.UUID         `gorm:"type:uuid;not null;uniqueIndex:idx_org_submission_settings_org_id"`
	EnabledSettlementKinds types.StringArray `gorm:"type:text[]"`
	SubmissionDeadline     *time.Time        `gorm:"type:date"`
	UpdatedAt              time.Time         `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	Organization Organization `gorm:"foreignKey:OrganizationID"`
}

func (OrganizationSubmissionSettings) TableName() string {
	return "organization_submission_settings"
}

func (m *OrganizationSubmissionSettings) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

func (m *OrganizationSubmissionSettings) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
