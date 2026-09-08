// Package audit provides the append-only audit log writer shared by the API
// services, auth flows, and CLI commands.
package audit

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	"gorm.io/gorm"
)

// Actions recorded in audit log entries. Values match the enum value names
// of gen.AuditLogEntry_Action without the ACTION_ prefix.
const (
	ActionCreate = "CREATE"
	ActionUpdate = "UPDATE"
	ActionDelete = "DELETE"
)

// Subject identifies the resource an audit log entry refers to.
type Subject struct {
	// ResourceName is the full resource name of the audited object
	// (e.g. "organizations/{org}/accounts/{acct}"). The resource type is
	// inferred from it.
	ResourceName string
	// ResourceID is the primary key of the audited object.
	ResourceID uuid.UUID
	// OrganizationID is the organization the object belongs to, or the zero
	// value for resources not subordinated under an organization.
	OrganizationID uuid.NullUUID
}

// Writer appends entries to the immutable audit log. It writes through the
// shared *gorm.DB and context only, so a future per-request transaction
// middleware will automatically include audit writes in the request
// transaction.
type Writer struct {
	repo *repository.AuditLogEntryRepository
}

// NewWriter creates a Writer backed by a new audit log entry repository.
func NewWriter(db *gorm.DB) *Writer {
	return &Writer{repo: repository.NewAuditLogEntryRepository(db)}
}

// Record appends one audit log entry describing the change from before to
// after. before and after are model struct pointers (of the same type) or
// nil: before=nil records a creation, after=nil records a deletion. Field
// values are rendered as strings; only fields whose rendered value changed
// are included.
//
// The returned error must be surfaced to the caller: a persisted mutation
// whose audit write failed must not be reported as success.
func (w *Writer) Record(ctx context.Context, subj Subject, action string, before, after any) error {
	changes, err := DiffModels(before, after)
	if err != nil {
		return fmt.Errorf("audit diff resource=%s: %w", subj.ResourceName, err)
	}
	// A no-op update (no field changed) is not a change worth recording.
	if action == ActionUpdate && len(changes) == 0 {
		return nil
	}
	return w.RecordChanges(ctx, subj, action, changes)
}

// RecordChanges appends one audit log entry with an explicitly built change
// list, for state that is not represented on a single DB model (e.g. group
// permissions stored in casbin).
func (w *Writer) RecordChanges(ctx context.Context, subj Subject, action string, changes []model.AuditLogEntryChange) error {
	entry := &model.AuditLogEntry{
		ResourceName:   subj.ResourceName,
		ResourceID:     subj.ResourceID,
		OrganizationID: subj.OrganizationID,
		Action:         action,
		ActorID:        actorID(ctx),
		Changes:        changes,
	}

	if err := w.repo.Create(ctx, entry); err != nil {
		return fmt.Errorf("audit record resource=%s: %w", subj.ResourceName, err)
	}
	return nil
}

// actorID extracts the acting user's UUID from the context, or the zero
// value for system changes.
func actorID(ctx context.Context) uuid.NullUUID {
	uid, ok := authz.UserIDFromContext(ctx)
	if !ok {
		return uuid.NullUUID{}
	}
	id, err := uuid.Parse(uid)
	if err != nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{Valid: true, UUID: id}
}

// skipFields are model fields excluded from the audit diff: the primary key
// (carried by the entry itself), timestamps, and the parent organization
// (carried by the entry's OrganizationID).
var skipFields = map[string]bool{
	"ID":             true,
	"CreatedAt":      true,
	"UpdatedAt":      true,
	"DeletedAt":      true,
	"OrganizationID": true,
}

// DiffModels computes the field-level changes between before and after.
func DiffModels(before, after any) ([]model.AuditLogEntryChange, error) {
	before = derefModel(before)
	after = derefModel(after)

	if before == nil && after == nil {
		return nil, nil
	}
	if before != nil && after != nil && reflect.TypeOf(before) != reflect.TypeOf(after) {
		return nil, fmt.Errorf("audit diff: before/after type mismatch (%T vs %T)", before, after)
	}

	// Work on the non-nil side; both sides share the same model type.
	side := after
	if side == nil {
		side = before
	}

	v := reflect.ValueOf(side)
	if v.Kind() != reflect.Pointer || v.Elem().Kind() != reflect.Struct {
		return nil, fmt.Errorf("audit diff: expected model struct pointer, got %T", side)
	}
	s := v.Elem()
	t := s.Type()

	// A nil before means creation: every field is new. A nil after means
	// deletion: every field is gone.
	creating := before == nil
	deleting := after == nil

	var other reflect.Value
	if !creating && !deleting {
		other = reflect.ValueOf(before).Elem()
	}

	var changes []model.AuditLogEntryChange
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.PkgPath != "" || skipFields[f.Name] {
			continue
		}
		if !isDiffableField(f.Type) {
			continue
		}

		newVal, err := renderValue(s.Field(i))
		if err != nil {
			return nil, fmt.Errorf("field %s: %w", f.Name, err)
		}

		var oldVal string
		if creating {
			oldVal = ""
		} else {
			oldVal = newVal
			if !deleting {
				oldVal, err = renderValue(other.Field(i))
				if err != nil {
					return nil, fmt.Errorf("field %s: %w", f.Name, err)
				}
			}
		}

		if creating && newVal == "" {
			// Skip empty fields of creations; the empty state is implied.
			continue
		}

		if deleting {
			changes = append(changes, model.AuditLogEntryChange{
				Field:    fieldName(f.Name),
				OldValue: changeValue(oldVal),
			})
			continue
		}

		if creating || oldVal != newVal {
			changes = append(changes, model.AuditLogEntryChange{
				Field:    fieldName(f.Name),
				OldValue: changeValue(oldVal),
				NewValue: changeValue(newVal),
			})
		}
	}

	return changes, nil
}

// derefModel returns the model pointer, or nil.
func derefModel(m any) any {
	if m == nil {
		return nil
	}
	v := reflect.ValueOf(m)
	if v.Kind() == reflect.Pointer && v.IsNil() {
		return nil
	}
	return m
}

// isDiffableField reports whether the field type carries auditable scalar
// state. Relation structs/slices and unsupported composites are excluded.
func isDiffableField(t reflect.Type) bool {
	for t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	switch t.Kind() {
	case reflect.String, reflect.Bool,
		reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Float32, reflect.Float64:
		return true
	case reflect.Struct:
		// Value types with canonical string renderings (uuid.UUID,
		// uuid.NullUUID, time.Time, apd.Decimal, ...) are diffable; plain
		// structs are relations and are not.
		return isRenderableStruct(t)
	case reflect.Slice, reflect.Array:
		return isDiffableField(t.Elem())
	default:
		return false
	}
}

// isRenderableStruct reports whether the struct type has an explicit audit
// rendering (timestamps, UUIDs, or fmt.Stringer implementations).
func isRenderableStruct(t reflect.Type) bool {
	if t == reflect.TypeOf(time.Time{}) ||
		t == reflect.TypeOf(uuid.UUID{}) ||
		t == reflect.TypeOf(uuid.NullUUID{}) {
		return true
	}
	m, ok := reflect.PointerTo(t).MethodByName("String")
	return ok && m.Type.NumIn() == 1 && m.Type.NumOut() == 1 && m.Type.Out(0).Kind() == reflect.String
}

// renderValue renders a field value as a canonical string for the diff.
func renderValue(v reflect.Value) (string, error) {
	if !v.IsValid() {
		return "", nil
	}
	for v.Kind() == reflect.Pointer || v.Kind() == reflect.Interface {
		if v.IsNil() {
			return "", nil
		}
		v = v.Elem()
	}

	switch val := v.Interface().(type) {
	case time.Time:
		return val.UTC().Format(time.RFC3339Nano), nil
	case uuid.UUID:
		return val.String(), nil
	case uuid.NullUUID:
		if !val.Valid {
			return "", nil
		}
		return val.UUID.String(), nil
	}

	// Prefer the addressable Stringer so pointer-receiver implementations
	// (e.g. apd.Decimal) are rendered canonically.
	if v.CanAddr() {
		if s, ok := v.Addr().Interface().(fmt.Stringer); ok {
			return s.String(), nil
		}
	}
	if s, ok := v.Interface().(fmt.Stringer); ok {
		return s.String(), nil
	}

	switch v.Kind() {
	case reflect.String:
		return v.String(), nil
	case reflect.Bool:
		if v.Bool() {
			return "true", nil
		}
		return "false", nil
	case reflect.Slice, reflect.Array:
		parts := make([]string, 0, v.Len())
		for i := 0; i < v.Len(); i++ {
			s, err := renderValue(v.Index(i))
			if err != nil {
				return "", err
			}
			parts = append(parts, s)
		}
		return "[" + strings.Join(parts, ",") + "]", nil
	default:
		return fmt.Sprintf("%v", v.Interface()), nil
	}
}

// changeValue converts a rendered value to the nullable proto-facing
// representation: nil means the field was absent.
func changeValue(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

// fieldName converts a Go struct field name to its snake_case API-facing
// name, keeping initialisms together (ParentAccountID → parent_account_id).
func fieldName(name string) string {
	runes := []rune(name)
	var b strings.Builder
	for i, r := range runes {
		if r >= 'A' && r <= 'Z' {
			prevLower := i > 0 && (runes[i-1] < 'A' || runes[i-1] > 'Z') && runes[i-1] != '_'
			nextLower := i+1 < len(runes) && runes[i+1] >= 'a' && runes[i+1] <= 'z'
			if i > 0 && (prevLower || nextLower) {
				b.WriteByte('_')
			}
			b.WriteRune(r + 32)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}
