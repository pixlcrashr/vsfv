package model

import (
	"time"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DocumentForm mirrors the proto DocumentForm enum.
type DocumentForm int

const (
	DocumentFormUnspecified DocumentForm = iota
	DocumentFormPaperOriginal
	DocumentFormDigitalOriginal
)

// SubmissionItem is a single bill/receipt (expense) or income document within
// a submission.
type SubmissionItem struct {
	ID                       uuid.UUID     `gorm:"type:uuid;primaryKey"`
	PublicID                 string        `gorm:"not null;default:'';uniqueIndex:idx_submission_items_submission_public_id,priority:2"`
	SubmissionID             uuid.UUID     `gorm:"type:uuid;not null;uniqueIndex:idx_submission_items_submission_public_id,priority:1;index:idx_submission_items_submission_id"`
	Category                 string        `gorm:"not null;default:''"`
	DocumentForm             DocumentForm  `gorm:"type:int;not null;default:0"`
	Source                   string        `gorm:"not null;default:''"`
	Description              string        `gorm:"not null;default:''"`
	Amount                   apd.Decimal   `gorm:"type:decimal;not null"`
	OriginalReceiveTime      *time.Time    `gorm:""`
	OriginalReceivedByUserID uuid.NullUUID `gorm:"type:uuid"`
	CreatedAt                time.Time     `gorm:"not null;default:CURRENT_TIMESTAMP"`
	UpdatedAt                time.Time     `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	Submission         Submission `gorm:"foreignKey:SubmissionID"`
	OriginalReceivedBy User       `gorm:"foreignKey:OriginalReceivedByUserID"`
}

func (SubmissionItem) TableName() string { return "submission_items" }

func (m *SubmissionItem) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

func (m *SubmissionItem) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
