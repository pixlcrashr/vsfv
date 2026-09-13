package xmlformat

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
)

// upsert creates or updates a record by its primary key. It makes the import
// idempotent so that re-importing the same XML (or importing into a database
// that already contains records from a previous import) does not fail on
// primary-key conflicts.
func upsert(tx *gorm.DB, value any) error {
	return upsertOn(tx, value, "id")
}

// upsertOn inserts value and updates the existing row on conflict. PostgreSQL
// requires an explicit conflict target for ON CONFLICT DO UPDATE, so callers
// must name the key that identifies the row: "id" for entities whose IDs come
// from the document, and the business unique key for value/assignment rows that
// get a fresh random ID on every import.
func upsertOn(tx *gorm.DB, value any, columns ...string) error {
	cols := make([]clause.Column, len(columns))
	for i, c := range columns {
		cols[i] = clause.Column{Name: c}
	}
	return tx.Clauses(clause.OnConflict{Columns: cols, UpdateAll: true}).Create(value).Error
}

// findExisting returns the existing record matching query (as a pointer to
// dest), or nil if no row matches. dest must be a pointer to a model struct.
func findExisting(tx *gorm.DB, dest interface{}, query string, args ...interface{}) (any, error) {
	conds := append([]interface{}{query}, args...)
	if err := tx.First(dest, conds...).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return dest, nil
}

// upsertAudited upserts a record and records a system audit log entry for it.
// findBefore returns the existing record (as any, or nil if not found) before
// the upsert; the audit action is CREATE when no prior record existed and
// UPDATE otherwise. upsertFn performs the actual write. after is the
// post-write model snapshot used as the "after" state for the audit diff.
// subjectFn builds the audit subject after the upsert so it can use model
// fields populated by BeforeCreate hooks (e.g. the fresh ID/CustomID of
// value/assignment rows).
//
// Audit entries are written through the same *gorm.DB (tx) so they
// participate in the import transaction. Because the import runs without an
// authenticated user in the context, the actor ID is the zero value — the
// audit entries are recorded as system changes.
func upsertAudited(
	ctx context.Context,
	audits *audit.Writer,
	subjectFn func() audit.Subject,
	findBefore func() (any, error),
	upsertFn func() error,
	after any,
) error {
	var before any
	if findBefore != nil {
		b, err := findBefore()
		if err != nil {
			return err
		}
		before = b
	}

	if err := upsertFn(); err != nil {
		return err
	}

	action := audit.ActionCreate
	if before != nil {
		action = audit.ActionUpdate
	}

	return audits.Record(ctx, subjectFn(), action, before, after)
}

// ImportDocument imports a V1 XML document into the given organization within a
// single database transaction.
func ImportDocument(ctx context.Context, db *gorm.DB, orgID uuid.UUID, doc *Document) error {
	if doc.Version != Version {
		return fmt.Errorf("unsupported format version %d, expected %d", doc.Version, Version)
	}

	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// The audit writer is backed by tx so audit entries are committed
		// (or rolled back) with the import. The import runs without an
		// authenticated user, so actor_id is the zero value (system).
		audits := audit.NewWriter(tx)
		orgNullID := uuid.NullUUID{Valid: true, UUID: orgID}

		accountIDMap := make(map[string]uuid.UUID)

		var insertAccounts func([]Account, uuid.NullUUID) error
		insertAccounts = func(accounts []Account, parentID uuid.NullUUID) error {
			for _, a := range accounts {
				if a.ID == "" {
					return fmt.Errorf("account missing id")
				}
				if _, exists := accountIDMap[a.ID]; exists {
					return fmt.Errorf("duplicate account id %q", a.ID)
				}

				id, err := uuid.Parse(a.ID)
				if err != nil {
					return fmt.Errorf("invalid account id %q: %w", a.ID, err)
				}

				customID := a.CustomID
				if customID == "" {
					customID = id.String()
				}

				isContainer := a.IsContainer || len(a.Children) > 0
				m := &model.Account{
					ID:                 id,
					CustomID:           customID,
					OrganizationID:     orgID,
					ParentAccountID:    parentID,
					DisplayName:        a.DisplayName,
					DisplayCode:        a.DisplayCode,
					DisplayDescription: a.DisplayDescription,
					IsContainer:        isContainer,
					IsArchived:         a.IsArchived,
				}
				if err := upsertAudited(ctx, audits, func() audit.Subject {
					return audit.Subject{
						ResourceName:   fmt.Sprintf("organizations/%s/accounts/%s", orgID, customID),
						ResourceID:     id,
						OrganizationID: orgNullID,
					}
				}, func() (any, error) {
					return findExisting(tx, &model.Account{}, "id = ?", id)
				}, func() error {
					return upsert(tx, m)
				}, m); err != nil {
					return fmt.Errorf("create account %q: %w", a.ID, err)
				}
				accountIDMap[a.ID] = id

				if len(a.Children) > 0 {
					if err := insertAccounts(a.Children, uuid.NullUUID{UUID: id, Valid: true}); err != nil {
						return err
					}
				}
			}
			return nil
		}

		if err := insertAccounts(doc.Accounts, uuid.NullUUID{}); err != nil {
			return err
		}

		// Ledger accounts
		ledgerAccountIDMap := make(map[string]uuid.UUID)
		// ledgerAccountCodeMap maps a ledger account UUID to its Code, used to
		// compute each transaction's JournalKey.
		ledgerAccountCodeMap := make(map[uuid.UUID]string)
		for _, la := range doc.LedgerAccounts {
			if la.ID == "" {
				return fmt.Errorf("ledger account missing id")
			}
			id, err := uuid.Parse(la.ID)
			if err != nil {
				return fmt.Errorf("invalid ledger account id %q: %w", la.ID, err)
			}
			customID := la.CustomID
			if customID == "" {
				customID = id.String()
			}
			accountType, err := accountTypeFromString(la.AccountType)
			if err != nil {
				return fmt.Errorf("ledger account %q: %w", la.ID, err)
			}
			m := &model.LedgerAccount{
				ID:                 id,
				CustomID:           customID,
				OrganizationID:     orgID,
				Code:               la.Code,
				AccountType:        accountType,
				DisplayName:        la.DisplayName,
				DisplayDescription: la.DisplayDescription,
			}
			if err := upsertAudited(ctx, audits, func() audit.Subject {
				return audit.Subject{
					ResourceName:   fmt.Sprintf("organizations/%s/ledgerAccounts/%s", orgID, customID),
					ResourceID:     id,
					OrganizationID: orgNullID,
				}
			}, func() (any, error) {
				return findExisting(tx, &model.LedgerAccount{}, "id = ?", id)
			}, func() error {
				return upsert(tx, m)
			}, m); err != nil {
				return fmt.Errorf("create ledger account %q: %w", la.ID, err)
			}
			ledgerAccountIDMap[la.ID] = id
			ledgerAccountCodeMap[id] = la.Code
		}

		// The legacy export may omit transaction_accounts that are referenced by
		// transactions but were never assigned through other means. Create minimal
		// placeholders for any transaction-side ledger account IDs not present in
		// the document's ledgerAccounts list so the import does not fail.
		for _, t := range doc.Transactions {
			for _, ref := range []string{t.CreditLedgerAccountID, t.DebitLedgerAccountID} {
				if ref == "" {
					continue
				}
				if _, ok := ledgerAccountIDMap[ref]; ok {
					continue
				}
				id, err := uuid.Parse(ref)
				if err != nil {
					return fmt.Errorf("transaction %q: invalid ledger account id %q: %w", t.ID, ref, err)
				}
				m := &model.LedgerAccount{
					ID:                 id,
					CustomID:           id.String(),
					OrganizationID:     orgID,
					Code:               id.String(),
					AccountType:        model.AccountTypeUnspecified,
					DisplayName:        "",
					DisplayDescription: "",
				}
				if err := upsertAudited(ctx, audits, func() audit.Subject {
					return audit.Subject{
						ResourceName:   fmt.Sprintf("organizations/%s/ledgerAccounts/%s", orgID, id),
						ResourceID:     id,
						OrganizationID: orgNullID,
					}
				}, func() (any, error) {
					return findExisting(tx, &model.LedgerAccount{}, "id = ?", id)
				}, func() error {
					return upsert(tx, m)
				}, m); err != nil {
					return fmt.Errorf("create missing ledger account %q referenced by transaction %q: %w", ref, t.ID, err)
				}
				ledgerAccountIDMap[ref] = id
				ledgerAccountCodeMap[id] = id.String()
			}
		}

		// Ledger years
		for _, ly := range doc.LedgerYears {
			if ly.ID == "" {
				return fmt.Errorf("ledger year missing id")
			}
			id, err := uuid.Parse(ly.ID)
			if err != nil {
				return fmt.Errorf("invalid ledger year id %q: %w", ly.ID, err)
			}
			customID := ly.CustomID
			if customID == "" {
				customID = id.String()
			}
			m := &model.LedgerYear{
				ID:             id,
				CustomID:       customID,
				OrganizationID: orgID,
				Year:           ly.Year,
				IsClosed:       ly.IsClosed,
			}
			if err := upsertAudited(ctx, audits, func() audit.Subject {
				return audit.Subject{
					ResourceName:   fmt.Sprintf("organizations/%s/ledgerYears/%s", orgID, customID),
					ResourceID:     id,
					OrganizationID: orgNullID,
				}
			}, func() (any, error) {
				return findExisting(tx, &model.LedgerYear{}, "id = ?", id)
			}, func() error {
				return upsert(tx, m)
			}, m); err != nil {
				return fmt.Errorf("create ledger year %q: %w", ly.ID, err)
			}
		}

		// Account groups (after accounts so references can be validated)
		accountGroupIDMap := make(map[string]uuid.UUID)
		accountGroupCustomIDMap := make(map[string]string)
		for _, g := range doc.AccountGroups {
			if g.ID == "" {
				return fmt.Errorf("account group missing id")
			}
			id, err := uuid.Parse(g.ID)
			if err != nil {
				return fmt.Errorf("invalid account group id %q: %w", g.ID, err)
			}
			customID := g.CustomID
			if customID == "" {
				customID = id.String()
			}
			m := &model.AccountGroup{
				ID:                 id,
				CustomID:           customID,
				OrganizationID:     orgID,
				DisplayName:        g.DisplayName,
				DisplayDescription: g.DisplayDescription,
			}
			if err := upsertAudited(ctx, audits, func() audit.Subject {
				return audit.Subject{
					ResourceName:   fmt.Sprintf("organizations/%s/accountGroups/%s", orgID, customID),
					ResourceID:     id,
					OrganizationID: orgNullID,
				}
			}, func() (any, error) {
				return findExisting(tx, &model.AccountGroup{}, "id = ?", id)
			}, func() error {
				return upsert(tx, m)
			}, m); err != nil {
				return fmt.Errorf("create account group %q: %w", g.ID, err)
			}
			accountGroupIDMap[g.ID] = id
			accountGroupCustomIDMap[g.ID] = customID
		}

		for _, g := range doc.AccountGroups {
			groupID := accountGroupIDMap[g.ID]
			groupCustomID := accountGroupCustomIDMap[g.ID]
			for _, a := range g.Assignments {
				accountID, ok := accountIDMap[a.AccountID]
				if !ok {
					return fmt.Errorf("account group %q assignment: unknown account id %q", g.ID, a.AccountID)
				}
				m := &model.AccountGroupAssignment{
					OrganizationID: orgID,
					AccountGroupID: groupID,
					AccountID:      accountID,
					Negate:         a.Negate,
				}
				if err := upsertAudited(ctx, audits, func() audit.Subject {
					return audit.Subject{
						ResourceName:   fmt.Sprintf("organizations/%s/accountGroups/%s/assignments/%s", orgID, groupCustomID, m.CustomID),
						ResourceID:     m.ID,
						OrganizationID: orgNullID,
					}
				}, func() (any, error) {
					return findExisting(tx, &model.AccountGroupAssignment{},
						"organization_id = ? AND account_group_id = ? AND account_id = ?",
						orgID, groupID, accountID)
				}, func() error {
					return upsertOn(tx, m, "organization_id", "account_group_id", "account_id")
				}, m); err != nil {
					return fmt.Errorf("create account group assignment: %w", err)
				}
			}
		}

		// Budgets and revisions
		for _, b := range doc.Budgets {
			if b.ID == "" {
				return fmt.Errorf("budget missing id")
			}
			budgetID, err := uuid.Parse(b.ID)
			if err != nil {
				return fmt.Errorf("invalid budget id %q: %w", b.ID, err)
			}

			periodStart, err := time.Parse(DateLayout, b.PeriodStart)
			if err != nil {
				return fmt.Errorf("budget %q: invalid period_start %q: %w", b.ID, b.PeriodStart, err)
			}
			periodEnd, err := time.Parse(DateLayout, b.PeriodEnd)
			if err != nil {
				return fmt.Errorf("budget %q: invalid period_end %q: %w", b.ID, b.PeriodEnd, err)
			}

			customID := b.CustomID
			if customID == "" {
				customID = budgetID.String()
			}

			bm := &model.Budget{
				ID:                  budgetID,
				CustomID:            customID,
				OrganizationID:      orgID,
				DisplayName:         b.DisplayName,
				DisplayDescription:  b.DisplayDescription,
				IsClosed:            b.IsClosed,
				IsPublished:         b.IsPublished,
				PublishActualValues: b.PublishActualValues,
				PeriodStart:         periodStart,
				PeriodEnd:           periodEnd,
			}
			if err := upsertAudited(ctx, audits, func() audit.Subject {
				return audit.Subject{
					ResourceName:   fmt.Sprintf("organizations/%s/budgets/%s", orgID, customID),
					ResourceID:     budgetID,
					OrganizationID: orgNullID,
				}
			}, func() (any, error) {
				return findExisting(tx, &model.Budget{}, "id = ?", budgetID)
			}, func() error {
				return upsert(tx, bm)
			}, bm); err != nil {
				return fmt.Errorf("create budget %q: %w", b.ID, err)
			}

			for _, v := range b.AccountValues {
				accountID, ok := accountIDMap[v.AccountID]
				if !ok {
					return fmt.Errorf("budget %q account value: unknown account id %q", b.ID, v.AccountID)
				}
				val, err := parseDecimal(v.Value)
				if err != nil {
					return fmt.Errorf("budget %q account value %q: %w", b.ID, v.AccountID, err)
				}
				bav := &model.BudgetAccountValue{
					OrganizationID: orgID,
					BudgetID:       budgetID,
					AccountID:      accountID,
					Value:          val,
				}
				if err := upsertAudited(ctx, audits, func() audit.Subject {
					return audit.Subject{
						ResourceName:   fmt.Sprintf("organizations/%s/budgets/%s/accountValues/%s", orgID, customID, bav.CustomID),
						ResourceID:     bav.ID,
						OrganizationID: orgNullID,
					}
				}, func() (any, error) {
					return findExisting(tx, &model.BudgetAccountValue{},
						"organization_id = ? AND budget_id = ? AND account_id = ?",
						orgID, budgetID, accountID)
				}, func() error {
					return upsertOn(tx, bav, "organization_id", "budget_id", "account_id")
				}, bav); err != nil {
					return fmt.Errorf("create budget account value: %w", err)
				}
			}

			for _, r := range b.Revisions {
				if r.ID == "" {
					return fmt.Errorf("budget %q revision missing id", b.ID)
				}
				revisionID, err := uuid.Parse(r.ID)
				if err != nil {
					return fmt.Errorf("budget %q invalid revision id %q: %w", b.ID, r.ID, err)
				}
				revDate, err := time.Parse(DateLayout, r.Date)
				if err != nil {
					return fmt.Errorf("budget %q revision %q: invalid date %q: %w", b.ID, r.ID, r.Date, err)
				}
				revCustomID := r.CustomID
				if revCustomID == "" {
					revCustomID = revisionID.String()
				}
				revDisplayName := r.DisplayName
				if revDisplayName == "" {
					revDisplayName = revDate.Format(DateLayout)
				}
				rm := &model.BudgetRevision{
					ID:                 revisionID,
					CustomID:           revCustomID,
					OrganizationID:     orgID,
					BudgetID:           budgetID,
					DisplayName:        revDisplayName,
					DisplayDescription: r.DisplayDescription,
					Date:               revDate,
				}
				if err := upsertAudited(ctx, audits, func() audit.Subject {
					return audit.Subject{
						ResourceName:   fmt.Sprintf("organizations/%s/budgets/%s/revisions/%s", orgID, customID, revCustomID),
						ResourceID:     revisionID,
						OrganizationID: orgNullID,
					}
				}, func() (any, error) {
					return findExisting(tx, &model.BudgetRevision{}, "id = ?", revisionID)
				}, func() error {
					return upsert(tx, rm)
				}, rm); err != nil {
					return fmt.Errorf("create budget revision %q: %w", r.ID, err)
				}

				for _, v := range r.AccountValues {
					accountID, ok := accountIDMap[v.AccountID]
					if !ok {
						return fmt.Errorf("revision %q account value: unknown account id %q", r.ID, v.AccountID)
					}
					val, err := parseDecimal(v.Value)
					if err != nil {
						return fmt.Errorf("revision %q account value %q: %w", r.ID, v.AccountID, err)
					}
					rav := &model.BudgetRevisionAccountValue{
						OrganizationID:   orgID,
						BudgetID:         budgetID,
						BudgetRevisionID: revisionID,
						AccountID:        accountID,
						Value:            val,
					}
					if err := upsertAudited(ctx, audits, func() audit.Subject {
						return audit.Subject{
							ResourceName:   fmt.Sprintf("organizations/%s/budgets/%s/revisions/%s/accountValues/%s", orgID, customID, revCustomID, rav.CustomID),
							ResourceID:     rav.ID,
							OrganizationID: orgNullID,
						}
					}, func() (any, error) {
						return findExisting(tx, &model.BudgetRevisionAccountValue{},
							"organization_id = ? AND budget_revision_id = ? AND account_id = ?",
							orgID, revisionID, accountID)
					}, func() error {
						return upsertOn(tx, rav, "organization_id", "budget_id", "budget_revision_id", "account_id")
					}, rav); err != nil {
						return fmt.Errorf("create revision account value: %w", err)
					}
				}
			}
		}

		// Transactions and assignments
		for _, t := range doc.Transactions {
			if t.ID == "" {
				return fmt.Errorf("transaction missing id")
			}
			transactionID, err := uuid.Parse(t.ID)
			if err != nil {
				return fmt.Errorf("invalid transaction id %q: %w", t.ID, err)
			}

			creditID, ok := ledgerAccountIDMap[t.CreditLedgerAccountID]
			if !ok {
				return fmt.Errorf("transaction %q: unknown credit ledger account id %q", t.ID, t.CreditLedgerAccountID)
			}
			debitID, ok := ledgerAccountIDMap[t.DebitLedgerAccountID]
			if !ok {
				return fmt.Errorf("transaction %q: unknown debit ledger account id %q", t.ID, t.DebitLedgerAccountID)
			}

			amount, err := parseDecimal(t.Amount)
			if err != nil {
				return fmt.Errorf("transaction %q: invalid amount %q: %w", t.ID, t.Amount, err)
			}

			bookedAt, err := time.Parse(DateLayout, t.BookedAt)
			if err != nil {
				return fmt.Errorf("transaction %q: invalid booked_at %q: %w", t.ID, t.BookedAt, err)
			}
			documentDate, err := time.Parse(DateLayout, t.DocumentDate)
			if err != nil {
				return fmt.Errorf("transaction %q: invalid document_date %q: %w", t.ID, t.DocumentDate, err)
			}

			customID := t.CustomID
			if customID == "" {
				customID = transactionID.String()
			}

			journalKey := model.ComputeTransactionJournalKey(bookedAt, documentDate, ledgerAccountCodeMap[creditID], ledgerAccountCodeMap[debitID], amount, t.Reference, t.Description)

			m := &model.Transaction_{
				ID:                    transactionID,
				JournalKey:            journalKey,
				OrganizationID:        orgID,
				CreditLedgerAccountID: creditID,
				DebitLedgerAccountID:  debitID,
				Amount:                amount,
				Description:           t.Description,
				Reference:             t.Reference,
				BookedAt:              bookedAt,
				DocumentDate:          documentDate,
			}
			if err := upsertAudited(ctx, audits, func() audit.Subject {
				return audit.Subject{
					ResourceName:   fmt.Sprintf("organizations/%s/transactions/%s", orgID, customID),
					ResourceID:     transactionID,
					OrganizationID: orgNullID,
				}
			}, func() (any, error) {
				return findExisting(tx, &model.Transaction_{}, "id = ?", transactionID)
			}, func() error {
				return upsert(tx, m)
			}, m); err != nil {
				return fmt.Errorf("create transaction %q: %w", t.ID, err)
			}

			assignments := t.Assignments
			if len(assignments) == 0 && t.AssignedAccountID != "" {
				assignments = []TransactionAssignment{
					{AccountID: t.AssignedAccountID, Value: t.Amount},
				}
			}

			for _, a := range assignments {
				accountID, ok := accountIDMap[a.AccountID]
				if !ok {
					return fmt.Errorf("transaction %q assignment: unknown account id %q", t.ID, a.AccountID)
				}
				value, err := parseDecimal(a.Value)
				if err != nil {
					return fmt.Errorf("transaction %q assignment %q: %w", t.ID, a.AccountID, err)
				}
				ta := &model.TransactionAssignment{
					OrganizationID: orgID,
					TransactionID:  transactionID,
					AccountID:      accountID,
					Value:          value,
				}
				if err := upsertAudited(ctx, audits, func() audit.Subject {
					return audit.Subject{
						ResourceName:   fmt.Sprintf("organizations/%s/transactions/%s/assignments/%s", orgID, customID, ta.ID),
						ResourceID:     ta.ID,
						OrganizationID: orgNullID,
					}
				}, func() (any, error) {
					return findExisting(tx, &model.TransactionAssignment{},
						"transaction_id = ? AND account_id = ?",
						transactionID, accountID)
				}, func() error {
					return upsertOn(tx, ta, "transaction_id", "account_id")
				}, ta); err != nil {
					return fmt.Errorf("create transaction assignment: %w", err)
				}
			}
		}

		return nil
	})
}
