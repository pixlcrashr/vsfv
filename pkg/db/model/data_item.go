package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DataItem holds the metadata of a single binary blob in the global
// FileStorage (file name, MIME type, size and SHA-256 hash). The blob is
// stored under the data item's UUID as file name. Data items are an internal
// building block and are never exposed through the public API: concrete use
// cases (e.g. submission attachments) reference them via their own relation
// tables and decide which metadata they surface.
type DataItem struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	FileName  string    `gorm:"not null;default:''"`
	MimeType  string    `gorm:"not null;default:''"`
	FileSize  int64     `gorm:"not null;default:0"`
	Sha256Sum string    `gorm:"type:varchar(64);not null;default:''"`
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`
}

func (DataItem) TableName() string { return "data_items" }

func (m *DataItem) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}

func (m *DataItem) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
