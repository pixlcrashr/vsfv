package services

import (
	"strings"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"gorm.io/gorm"
)

// Audit actions recorded in audit log entries.
const (
	AuditActionCreate = audit.ActionCreate
	AuditActionUpdate = audit.ActionUpdate
	AuditActionDelete = audit.ActionDelete
)

// auditSubject identifies the resource an audit log entry refers to.
type auditSubject = audit.Subject

// auditWriter appends entries to the immutable audit log. It writes through
// the shared *gorm.DB and context only, so a future per-request transaction
// middleware will automatically include audit writes in the request
// transaction.
type auditWriter = audit.Writer

func newAuditWriter(db *gorm.DB) *auditWriter {
	return audit.NewWriter(db)
}

// diffAuditModels computes the field-level audit diff between two model
// snapshots.
func diffAuditModels(before, after any) ([]model.AuditLogEntryChange, error) {
	return audit.DiffModels(before, after)
}

// orgAuditSubject builds an audit subject for a resource nested under an
// organization.
func orgAuditSubject(resourceName string, orgID, resourceID uuid.UUID) auditSubject {
	return auditSubject{
		ResourceName:   resourceName,
		ResourceID:     resourceID,
		OrganizationID: uuid.NullUUID{Valid: true, UUID: orgID},
	}
}

// stringSliceChange builds an audit change for a replaced string list
// (e.g. group permissions or organization assignments).
func stringSliceChange(field string, oldValues, newValues []string) model.AuditLogEntryChange {
	join := func(vs []string) *string {
		if len(vs) == 0 {
			return nil
		}
		joined := strings.Join(vs, ",")
		return &joined
	}
	return model.AuditLogEntryChange{
		Field:    field,
		OldValue: join(oldValues),
		NewValue: join(newValues),
	}
}
