package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SubmissionComment is a comment on a submission. Admin-only comments are
// only visible to the treasury.
//
// StatusFrom/StatusTo record an optional status transition associated with
// the comment (e.g. a rejection); both zero values mean "no status change"
// (SubmissionStatusUnspecified is never a valid transition endpoint).
type SubmissionComment struct {
	ID           uuid.UUID     `gorm:"type:uuid;primaryKey"`
	SubmissionID uuid.UUID     `gorm:"type:uuid;not null;index:idx_submission_comments_submission_id"`
	AuthorUserID uuid.NullUUID `gorm:"type:uuid"`
	Content      string        `gorm:"not null;default:''"`
	IsAdminOnly  bool          `gorm:"not null;default:false"`
	StatusFrom   int32         `gorm:"not null;default:0"`
	StatusTo     int32         `gorm:"not null;default:0"`
	CreatedAt    time.Time     `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	Submission Submission `gorm:"foreignKey:SubmissionID"`
	Author     User       `gorm:"foreignKey:AuthorUserID"`
}

func (SubmissionComment) TableName() string { return "submission_comments" }

func (m *SubmissionComment) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

func (m *SubmissionComment) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
