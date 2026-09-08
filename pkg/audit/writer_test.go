package audit

import (
	"context"
	"testing"
	"time"

	apd "github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	"gorm.io/gorm"
)

func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	// Windows paths cannot be embedded in the sqlite:// DSN (URL parsing),
	// so run in a temp directory and use a bare file name.
	t.Chdir(t.TempDir())
	gormDB, err := db.ConnectSilent("sqlite://audit-test.db")
	if err != nil {
		t.Fatalf("connect sqlite: %v", err)
	}
	if err := db.AutoMigrate(gormDB); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := gormDB.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return gormDB
}

func TestRecordAndList(t *testing.T) {
	gormDB := newTestDB(t)
	ctx := authz.WithUser(context.Background(), "00000000-0000-0000-0000-000000000001", nil)

	w := NewWriter(gormDB)
	orgID := uuid.MustParse("10000000-0000-0000-0000-000000000001")

	before := &model.Account{
		ID:                 uuid.MustParse("20000000-0000-0000-0000-000000000001"),
		DisplayName:        "Kasse",
		DisplayCode:        "1000",
		DisplayDescription: "",
		IsContainer:        false,
	}
	after := &model.Account{
		ID:                 before.ID,
		DisplayName:        "Kasse (Bar)",
		DisplayCode:        "1000",
		DisplayDescription: "Bar payments",
		IsContainer:        false,
	}

	subject := Subject{
		ResourceName:   "organizations/org1/accounts/demo-cash",
		ResourceID:     before.ID,
		OrganizationID: uuid.NullUUID{Valid: true, UUID: orgID},
	}

	if err := w.Record(ctx, subject, ActionUpdate, before, after); err != nil {
		t.Fatalf("record update: %v", err)
	}

	// A no-op update must not be recorded.
	if err := w.Record(ctx, subject, ActionUpdate, after, after); err != nil {
		t.Fatalf("record no-op: %v", err)
	}

	// A creation records the full state.
	if err := w.Record(ctx, subject, ActionCreate, nil, after); err != nil {
		t.Fatalf("record create: %v", err)
	}

	// A deletion records the final state with no new values.
	if err := w.Record(ctx, subject, ActionDelete, before, nil); err != nil {
		t.Fatalf("record delete: %v", err)
	}

	repo := repository.NewAuditLogEntryRepository(gormDB)

	// Give the three entries distinct timestamps so their relative order is
	// deterministic (same-instant entries tie-break by random UUID).
	base := time.Now().Add(-time.Hour)
	if err := gormDB.WithContext(ctx).Exec(
		`UPDATE audit_log_entries SET created_at = ? WHERE action = ?`,
		base, ActionUpdate,
	).Error; err != nil {
		t.Fatalf("backdate update entry: %v", err)
	}
	if err := gormDB.WithContext(ctx).Exec(
		`UPDATE audit_log_entries SET created_at = ? WHERE action = ?`,
		base.Add(time.Minute), ActionCreate,
	).Error; err != nil {
		t.Fatalf("backdate create entry: %v", err)
	}
	if err := gormDB.WithContext(ctx).Exec(
		`UPDATE audit_log_entries SET created_at = ? WHERE action = ?`,
		base.Add(2*time.Minute), ActionDelete,
	).Error; err != nil {
		t.Fatalf("backdate delete entry: %v", err)
	}

	entries, total, err := repo.List(ctx, repository.ListAuditLogEntriesParams{
		OrganizationIDs: []uuid.UUID{orgID},
		Page:            1,
		PageSize:        10,
	})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if total != 3 || len(entries) != 3 {
		t.Fatalf("expected 3 entries, got total=%d len=%d", total, len(entries))
	}

	// Entries are listed newest first.
	if entries[0].Action != ActionDelete || entries[1].Action != ActionCreate || entries[2].Action != ActionUpdate {
		actions := []string{entries[0].Action, entries[1].Action, entries[2].Action}
		t.Fatalf("unexpected action order: %v", actions)
	}

	upd := entries[2]
	if upd.ActorID.Valid != true || upd.ActorID.UUID.String() != "00000000-0000-0000-0000-000000000001" {
		t.Fatalf("unexpected actor: %+v", upd.ActorID)
	}
	changes := map[string][2]*string{}
	for _, c := range upd.Changes {
		changes[c.Field] = [2]*string{c.OldValue, c.NewValue}
	}
	displayName, ok := changes["display_name"]
	if !ok {
		t.Fatalf("display_name change missing: %+v", upd.Changes)
	}
	if displayName[0] == nil || *displayName[0] != "Kasse" {
		t.Fatalf("unexpected old display_name: %v", displayName[0])
	}
	if displayName[1] == nil || *displayName[1] != "Kasse (Bar)" {
		t.Fatalf("unexpected new display_name: %v", displayName[1])
	}
	if _, ok := changes["display_code"]; ok {
		t.Fatalf("unchanged field must not be recorded")
	}
	if _, ok := changes["created_at"]; ok {
		t.Fatalf("timestamps must be excluded from the diff")
	}

	del := entries[0]
	if len(del.Changes) == 0 {
		t.Fatalf("deletion must record the final state")
	}
	for _, c := range del.Changes {
		if c.NewValue != nil {
			t.Fatalf("deletion changes must have no new value: %+v", c)
		}
	}

	crea := entries[1]
	for _, c := range crea.Changes {
		if c.OldValue != nil {
			t.Fatalf("creation changes must have no old value: %+v", c)
		}
	}

	// Entries of other organizations are excluded by the restriction.
	other, totalOther, err := repo.List(ctx, repository.ListAuditLogEntriesParams{
		OrganizationIDs: []uuid.UUID{uuid.MustParse("90000000-0000-0000-0000-000000000009")},
		Page:            1,
		PageSize:        10,
	})
	if err != nil {
		t.Fatalf("list other org: %v", err)
	}
	if totalOther != 0 || len(other) != 0 {
		t.Fatalf("expected no entries for other org, got %d", totalOther)
	}

	// GetByID roundtrip preserves the JSON-encoded changes.
	got, err := repo.GetByID(ctx, upd.ID)
	if err != nil {
		t.Fatalf("get by id: %v", err)
	}
	if got.ResourceName != subject.ResourceName {
		t.Fatalf("unexpected resource name: %s", got.ResourceName)
	}
	if !got.CreatedAt.After(time.Time{}) {
		t.Fatalf("created_at must be set")
	}
}

func TestDiffSkipsRelationsAndRendersValues(t *testing.T) {
	orgID := uuid.New()
	before := &model.Account{
		ID:              uuid.New(),
		OrganizationID:  orgID,
		ParentAccountID: uuid.NullUUID{},
		DisplayName:     "a",
		IsArchived:      false,
	}
	after := &model.Account{
		ID:              before.ID,
		OrganizationID:  orgID,
		ParentAccountID: uuid.NullUUID{Valid: true, UUID: uuid.New()},
		DisplayName:     "b",
		IsArchived:      true,
	}

	changes, err := DiffModels(before, after)
	if err != nil {
		t.Fatalf("diff: %v", err)
	}

	fields := map[string]bool{}
	for _, c := range changes {
		fields[c.Field] = true
	}
	if fields["id"] || fields["organization_id"] {
		t.Fatalf("primary key and organization must be skipped: %v", fields)
	}
	if !fields["parent_account_id"] || !fields["display_name"] || !fields["is_archived"] {
		t.Fatalf("expected parent_account_id/display_name/is_archived changes: %v", fields)
	}
}

func TestOptionalFieldsDiff(t *testing.T) {
	// Exercise the optional.Optional-style updates indirectly through the
	// budget model, which carries sql.NullTime-like fields.
	before := &model.BudgetAccountValue{
		ID:        uuid.New(),
		Value:     mustDecimal(t, "1.00"),
		BudgetID:  uuid.New(),
		AccountID: uuid.New(),
	}
	after := &model.BudgetAccountValue{
		ID:        before.ID,
		Value:     mustDecimal(t, "2.50"),
		BudgetID:  before.BudgetID,
		AccountID: before.AccountID,
	}

	changes, err := DiffModels(before, after)
	if err != nil {
		t.Fatalf("diff: %v", err)
	}
	if len(changes) != 1 || changes[0].Field != "value" {
		t.Fatalf("expected single value change, got %+v", changes)
	}
	if changes[0].OldValue == nil || *changes[0].OldValue != "1.00" {
		t.Fatalf("unexpected old value: %v", changes[0].OldValue)
	}
	if changes[0].NewValue == nil || *changes[0].NewValue != "2.50" {
		t.Fatalf("unexpected new value: %v", changes[0].NewValue)
	}
}

func mustDecimal(t *testing.T, s string) apd.Decimal {
	t.Helper()
	var d apd.Decimal
	if _, _, err := d.SetString(s); err != nil {
		t.Fatalf("set decimal %q: %v", s, err)
	}
	return d
}
