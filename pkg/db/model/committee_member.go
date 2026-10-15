package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CommitteeMember assigns a user to a committee. Members of a committee may
// create submissions on behalf of the committee.
type CommitteeMember struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey"`
	CommitteeID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_committee_members_committee_user,priority:1;index:idx_committee_members_committee_id"`
	UserID      uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_committee_members_committee_user,priority:2;index:idx_committee_members_user_id"`
	CreatedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	Committee Committee `gorm:"foreignKey:CommitteeID"`
	User      User      `gorm:"foreignKey:UserID"`
}

func (CommitteeMember) TableName() string { return "committee_members" }

func (m *CommitteeMember) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

func (m *CommitteeMember) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
