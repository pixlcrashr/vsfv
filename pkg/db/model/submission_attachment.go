package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SubmissionAttachment holds the metadata of a binary file attached to a
// submission item. The binary itself lives on disk (storage key references
// the file) and is served by the Huma attachment endpoints.
type SubmissionAttachment struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey"`
	SubmissionItemID uuid.UUID `gorm:"type:uuid;not null;index:idx_submission_attachments_item_id"`
	FileName         string    `gorm:"not null;default:''"`
	MimeType         string    `gorm:"not null;default:''"`
	FileSize         int64     `gorm:"not null;default:0"`
	StorageKey       string    `gorm:"not null;default:'';uniqueIndex:idx_submission_attachments_storage_key"`
	CreatedAt        time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	SubmissionItem SubmissionItem `gorm:"foreignKey:SubmissionItemID"`
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
