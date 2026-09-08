package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/model/dao"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"gorm.io/gorm"
)

var ErrAuditLogEntryNotFound = errors.New("audit log entry not found")

// AuditLogEntryOrderFieldMapper maps API order_by field names to database column names.
var AuditLogEntryOrderFieldMapper = order.FieldMapper{
	"timestamp": "created_at",
	"resource":  "resource_name",
	"action":    "action",
}

// ListAuditLogEntriesParams drives the List query.
type ListAuditLogEntriesParams struct {
	// Cond is an optional abstract condition chain over resource/action/timestamp.
	Cond cond.Cond
	// OrganizationIDs, when non-empty, restricts results to entries belonging
	// to these organizations. Nil means no restriction.
	OrganizationIDs []uuid.UUID
	// OrderBy specifies the sort field and direction as SQL expressions.
	OrderBy []order.Expr
	// Page number (1-indexed).
	Page int
	// PageSize caps the number of rows returned.
	PageSize int
}

// auditLogEntryColumnMapper maps filter field names to database column names.
func auditLogEntryColumnMapper(field string) (string, bool) {
	switch field {
	case "resource":
		return "resource_name", true
	case "actor_id":
		return "actor_id", true
	case "action":
		return "action", true
	case "timestamp":
		return "created_at", true
	default:
		return "", false
	}
}

// AuditLogEntryRepository provides append-only write and read queries for the
// audit_log_entries table.
type AuditLogEntryRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewAuditLogEntryRepository creates an AuditLogEntryRepository backed by db.
func NewAuditLogEntryRepository(db *gorm.DB) *AuditLogEntryRepository {
	return &AuditLogEntryRepository{db: db, q: dao.Use(db)}
}

// Create appends a new audit log entry. Existing entries are never modified
// or deleted.
func (r *AuditLogEntryRepository) Create(ctx context.Context, m *model.AuditLogEntry) error {
	if err := r.q.AuditLogEntry.WithContext(ctx).Create(m); err != nil {
		return fmt.Errorf("create audit log entry resource=%s: %w", m.ResourceName, err)
	}
	return nil
}

// GetByID returns the audit log entry with the given ID.
func (r *AuditLogEntryRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.AuditLogEntry, error) {
	m, err := r.q.AuditLogEntry.WithContext(ctx).Where(r.q.AuditLogEntry.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrAuditLogEntryNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get audit log entry id=%s: %w", id, err)
	}
	return m, nil
}

// List returns audit log entries matching params along with the total count.
func (r *AuditLogEntryRepository) List(ctx context.Context, params ListAuditLogEntriesParams) ([]*model.AuditLogEntry, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 100
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	db := r.db.WithContext(ctx).Table("audit_log_entries")

	db = cond.Apply(db, params.Cond, auditLogEntryColumnMapper)

	if len(params.OrganizationIDs) > 0 {
		db = db.Where("organization_id IN ?", params.OrganizationIDs)
	} else if params.OrganizationIDs != nil {
		// An explicitly empty restriction (org-scoped caller without any
		// permitted organization) must yield no results.
		db = db.Where("1 = 0")
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count audit log entries page=%d: %w", params.Page, err)
	}

	if len(params.OrderBy) > 0 {
		for _, expr := range params.OrderBy {
			db = db.Order(expr.String())
		}
	} else {
		db = db.Order("created_at DESC")
	}

	offset := (params.Page - 1) * params.PageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(params.PageSize)

	var ms []*model.AuditLogEntry
	if err := db.Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list audit log entries page=%d: %w", params.Page, err)
	}

	return ms, total, nil
}
