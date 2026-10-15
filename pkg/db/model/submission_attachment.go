package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SubmissionAttachment is the relation between a submission item and the
// DataItem holding the attached binary. All file metadata lives on the data
// item; this table only expresses that the blob belongs to the item.
type SubmissionAttachment struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey"`
	SubmissionItemID uuid.UUID `gorm:"type:uuid;not null;index:idx_submission_attachments_item_id"`
	DataItemID       uuid.UUID `gorm:"type:uuid;not null;index:idx_submission_attachments_data_item_id"`
	CreatedAt        time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	SubmissionItem SubmissionItem `gorm:"foreignKey:SubmissionItemID"`
	DataItem       DataItem       `gorm:"foreignKey:DataItemID"`
}

func (SubmissionAttachment) TableName() string { return "submission_attachments" }

func (m *SubmissionAttachment) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

func (m *SubmissionAttachment) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
