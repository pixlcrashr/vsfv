package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AuditLogEntryChange records the old and new value of a single field within
// an audit log entry. A nil pointer means the field was absent (or null) in
// that state; old_value is nil for all changes of a creation and new_value is
// nil for all changes of a deletion.
type AuditLogEntryChange struct {
	Field    string  `json:"field"`
	OldValue *string `json:"old_value,omitempty"`
	NewValue *string `json:"new_value,omitempty"`
}

// AuditLogEntry is an immutable record of a single change to a resource.
// Entries are append-only: they are never updated or deleted, and they
// intentionally carry no foreign keys so that they survive the deletion of
// the audited resource (and its organization).
type AuditLogEntry struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`

	// ResourceName is the full resource name of the audited object at the
	// time of the change (e.g. "organizations/{org}/accounts/{acct}").
	ResourceName string `gorm:"not null;index:idx_audit_log_entries_resource_name"`
	// ResourceID is the primary key (UUID) of the audited object.
	ResourceID uuid.UUID `gorm:"type:uuid;not null;index:idx_audit_log_entries_resource_id"`
	// OrganizationID is the organization the audited object belongs to, or
	// nil for resources not subordinated under an organization.
	OrganizationID uuid.NullUUID `gorm:"type:uuid;index:idx_audit_log_entries_organization_id"`

	// Action is the kind of change (create, update, delete, archive, restore,
	// close).
	Action string `gorm:"not null;default:'';index:idx_audit_log_entries_action"`
	// ActorID is the user who performed the change, or nil for system changes.
	ActorID uuid.NullUUID `gorm:"type:uuid;index:idx_audit_log_entries_actor_id"`

	// Changes holds the per-field diff of the change.
	Changes []AuditLogEntryChange `gorm:"type:jsonb;serializer:json"`

	// CreatedAt is the time at which the change was recorded. There is no
	// UpdatedAt: entries are immutable.
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP;index:idx_audit_log_entries_created_at"`
}

func (AuditLogEntry) TableName() string { return "audit_log_entries" }

func (m *AuditLogEntry) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}

	return nil
}

func (m *AuditLogEntry) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
