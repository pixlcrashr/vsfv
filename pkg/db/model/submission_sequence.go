package model

import (
	"github.com/google/uuid"
)

// SubmissionSequence allocates the per-organization-year sequence numbers for
// submission public IDs ("{year}/{seq}"). There is one row per organization
// and year; the next value is claimed atomically via an upsert on submission
// creation. Sequence numbers are not gap-free: rolled-back transactions
// consume their value.
type SubmissionSequence struct {
	OrganizationID uuid.UUID `gorm:"type:uuid;primaryKey"`
	Year           int       `gorm:"primaryKey"`
	NextValue      int64     `gorm:"not null"`
}

func (SubmissionSequence) TableName() string {
	return "submission_sequences"
}
