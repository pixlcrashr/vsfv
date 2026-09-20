package xmlformat

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

func setupTestDB(t *testing.T) *gorm.DB {
	dbConn, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(dbConn))
	return dbConn
}

func TestImportExportRoundtrip(t *testing.T) {
	dbConn := setupTestDB(t)
	ctx := t.Context()

	orgID := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	doc := &Document{
		Version: Version,
		Organizations: []Organization{{
			ID:                 orgID.String(),
			CustomID:           "mein-verein",
			DisplayName:        "Mein Verein e.V.",
			DisplayDescription: "Haushaltsplan",
			StartMonth:         7,
			Accounts: []Account{
				{
					ID:          "10000000-0000-0000-0000-000000000001",
					DisplayName: "Root",
					Children: []Account{
						{
							ID:              "10000000-0000-0000-0000-000000000002",
							ParentAccountID: "10000000-0000-0000-0000-000000000001",
							DisplayName:     "Child",
						},
					},
				},
			},
			LedgerAccounts: []LedgerAccount{
				{
					ID:          "20000000-0000-0000-0000-000000000001",
					Code:        "1000",
					AccountType: "asset",
					DisplayName: "Bank",
				},
			},
			Budgets: []Budget{
				{
					ID:          "30000000-0000-0000-0000-000000000001",
					DisplayName: "Budget 2026",
					PeriodStart: "2026-01-01",
					PeriodEnd:   "2026-12-31",
					AccountValues: []BudgetValue{
						{AccountID: "10000000-0000-0000-0000-000000000002", Value: "1000.00"},
					},
					Revisions: []BudgetRevision{
						{
							ID:   "31000000-0000-0000-0000-000000000001",
							Date: "2026-03-01",
							AccountValues: []BudgetValue{
								{AccountID: "10000000-0000-0000-0000-000000000002", Value: "200.00"},
							},
						},
					},
				},
			},
			Transactions: []Transaction{
				{
					ID:                    "40000000-0000-0000-0000-000000000001",
					CreditLedgerAccountID: "20000000-0000-0000-0000-000000000001",
					DebitLedgerAccountID:  "20000000-0000-0000-0000-000000000001",
					Amount:                "50.00",
					BookedAt:              "2026-01-15",
					DocumentDate:          "2026-01-15",
					Assignments: []TransactionAssignment{
						{AccountID: "10000000-0000-0000-0000-000000000002", Value: "50.00"},
					},
				},
			},
		}},
	}

	require.NoError(t, ImportDocument(ctx, dbConn, orgID, doc))

	// The organization record itself is restored from the document.
	var org model.Organization
	require.NoError(t, dbConn.Where("id = ?", orgID).First(&org).Error)
	require.Equal(t, "mein-verein", org.CustomID)
	require.Equal(t, "Mein Verein e.V.", org.DisplayName)
	require.Equal(t, "Haushaltsplan", org.DisplayDescription)
	require.EqualValues(t, 7, org.StartMonth)

	// The organization restore is recorded in the audit log as a system change.
	var orgAudits int64
	require.NoError(t, dbConn.Model(&model.AuditLogEntry{}).
		Where("resource_name = ? AND action = ?", "organizations/mein-verein", "CREATE").
		Count(&orgAudits).Error)
	require.EqualValues(t, 1, orgAudits)

	deps := &ExportRepositoryDependencies{
		OrganizationRepo:               repository.NewOrganizationRepository(dbConn),
		AccountRepo:                    repository.NewAccountRepository(dbConn),
		AccountGroupRepo:               repository.NewAccountGroupRepository(dbConn),
		AccountGroupAssignmentRepo:     repository.NewAccountGroupAssignmentRepository(dbConn),
		BudgetRepo:                     repository.NewBudgetRepository(dbConn),
		BudgetAccountValueRepo:         repository.NewBudgetAccountValueRepository(dbConn),
		BudgetRevisionRepo:             repository.NewBudgetRevisionRepository(dbConn),
		BudgetRevisionAccountValueRepo: repository.NewBudgetRevisionAccountValueRepository(dbConn),
		LedgerAccountRepo:              repository.NewLedgerAccountRepository(dbConn),
		LedgerYearRepo:                 repository.NewLedgerYearRepository(dbConn),
		TransactionRepo:                repository.NewTransactionRepository(dbConn),
		TransactionAssignmentRepo:      repository.NewTransactionAssignmentRepository(dbConn),
	}
	exported, err := ExportOrganization(ctx, deps, orgID)
	require.NoError(t, err)

	require.Len(t, exported.Organizations, 1)
	exportedOrg := exported.Organizations[0]
	require.Equal(t, orgID.String(), exportedOrg.ID)
	require.Equal(t, "mein-verein", exportedOrg.CustomID)
	require.Equal(t, "Mein Verein e.V.", exportedOrg.DisplayName)
	require.Equal(t, "Haushaltsplan", exportedOrg.DisplayDescription)
	require.Equal(t, 7, exportedOrg.StartMonth)
	require.Len(t, exportedOrg.Accounts, 1)
	require.Len(t, exportedOrg.Accounts[0].Children, 1)
	require.Len(t, exportedOrg.LedgerAccounts, 1)
	require.Len(t, exportedOrg.Budgets, 1)
	require.Len(t, exportedOrg.Budgets[0].AccountValues, 1)
	require.Len(t, exportedOrg.Budgets[0].Revisions, 1)
	require.Equal(t, "2026-03-01", exportedOrg.Budgets[0].Revisions[0].DisplayName)
	require.Len(t, exportedOrg.Transactions, 1)
	require.Len(t, exportedOrg.Transactions[0].Assignments, 1)
}

func TestImportUnsupportedVersion(t *testing.T) {
	dbConn := setupTestDB(t)
	doc := &Document{Version: 99}
	err := ImportDocument(t.Context(), dbConn, uuid.New(), doc)
	require.Error(t, err)
	require.Contains(t, err.Error(), "unsupported format version")
}

// TestImportRequiresExactlyOneOrganization verifies that documents with zero or
// multiple organizations are rejected: the format structure supports more, but
// only one organization per file is currently supported.
func TestImportRequiresExactlyOneOrganization(t *testing.T) {
	dbConn := setupTestDB(t)

	for _, organizations := range [][]Organization{nil, {
		{ID: "00000000-0000-0000-0000-000000000001", DisplayName: "One"},
		{ID: "00000000-0000-0000-0000-000000000002", DisplayName: "Two"},
	}} {
		doc := &Document{Version: Version, Organizations: organizations}
		err := ImportDocument(t.Context(), dbConn, uuid.New(), doc)
		require.Error(t, err)
		require.Contains(t, err.Error(), "expected exactly one organization")
	}
}

// TestImportTwiceIsIdempotent imports the same document twice into the same
// organization. Value and assignment rows get fresh IDs on every import, so the
// second run must hit the business-key conflict targets instead of "id".
func TestImportTwiceIsIdempotent(t *testing.T) {
	dbConn := setupTestDB(t)
	ctx := t.Context()

	orgID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	require.NoError(t, dbConn.Create(&model.Organization{
		ID:          orgID,
		DisplayName: "Test",
	}).Error)

	doc := &Document{
		Version: Version,
		Organizations: []Organization{{
			DisplayName: "Test",
			Accounts: []Account{
				{
					ID:          "10000000-0000-0000-0000-000000000001",
					DisplayName: "Root",
				},
			},
			LedgerAccounts: []LedgerAccount{
				{ID: "20000000-0000-0000-0000-000000000001", Code: "1000", DisplayName: "Bank"},
			},
			Budgets: []Budget{
				{
					ID:          "30000000-0000-0000-0000-000000000001",
					DisplayName: "Budget 2026",
					PeriodStart: "2026-01-01",
					PeriodEnd:   "2026-12-31",
					Revisions: []BudgetRevision{
						{
							ID:   "31000000-0000-0000-0000-000000000001",
							Date: "2026-03-01",
							AccountValues: []BudgetValue{
								{AccountID: "10000000-0000-0000-0000-000000000001", Value: "200.00"},
							},
						},
					},
				},
			},
			Transactions: []Transaction{
				{
					ID:                    "40000000-0000-0000-0000-000000000001",
					CreditLedgerAccountID: "20000000-0000-0000-0000-000000000001",
					DebitLedgerAccountID:  "20000000-0000-0000-0000-000000000001",
					Amount:                "50.00",
					BookedAt:              "2026-01-15",
					DocumentDate:          "2026-01-15",
					Assignments: []TransactionAssignment{
						{AccountID: "10000000-0000-0000-0000-000000000001", Value: "50.00"},
					},
				},
			},
		}},
	}

	require.NoError(t, ImportDocument(ctx, dbConn, orgID, doc))
	require.NoError(t, ImportDocument(ctx, dbConn, orgID, doc))

	var ravCount, taCount int64
	require.NoError(t, dbConn.Model(&model.BudgetRevisionAccountValue{}).Where("organization_id = ?", orgID).Count(&ravCount).Error)
	require.NoError(t, dbConn.Model(&model.TransactionAssignment{}).Where("organization_id = ?", orgID).Count(&taCount).Error)
	require.EqualValues(t, 1, ravCount)
	require.EqualValues(t, 1, taCount)
}

func TestImportAutoCreatesMissingLedgerAccount(t *testing.T) {
	dbConn := setupTestDB(t)
	ctx := t.Context()

	orgID := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	require.NoError(t, dbConn.Create(&model.Organization{
		ID:          orgID,
		DisplayName: "Test",
	}).Error)

	missingLedgerID := "20000000-0000-0000-0000-000000000002"

	doc := &Document{
		Version: Version,
		Organizations: []Organization{{
			DisplayName: "Test",
			Accounts: []Account{
				{
					ID:          "10000000-0000-0000-0000-000000000001",
					DisplayName: "Root",
				},
			},
			LedgerAccounts: []LedgerAccount{
				{
					ID:          "20000000-0000-0000-0000-000000000001",
					Code:        "1000",
					AccountType: "asset",
					DisplayName: "Bank",
				},
			},
			Transactions: []Transaction{
				{
					ID:                    "40000000-0000-0000-0000-000000000001",
					CreditLedgerAccountID: "20000000-0000-0000-0000-000000000001",
					DebitLedgerAccountID:  missingLedgerID,
					Amount:                "50.00",
					BookedAt:              "2026-01-15",
					DocumentDate:          "2026-01-15",
					AssignedAccountID:     "10000000-0000-0000-0000-000000000001",
				},
			},
		}},
	}

	require.NoError(t, ImportDocument(ctx, dbConn, orgID, doc))

	var ledgerAccounts []model.LedgerAccount
	require.NoError(t, dbConn.Where("organization_id = ?", orgID).Find(&ledgerAccounts).Error)
	require.Len(t, ledgerAccounts, 2)

	var found bool
	for _, la := range ledgerAccounts {
		if la.ID.String() == missingLedgerID {
			found = true
			require.Equal(t, missingLedgerID, la.Code)
			require.Equal(t, model.AccountTypeUnspecified, la.AccountType)
		}
	}
	require.True(t, found, "missing ledger account was not auto-created")
}

// TestImportRestoresOrganizationIntoExistingOrganization imports a document
// into an already existing target organization. The organization details are
// restored while an omitted customId keeps the existing one (casbin group
// assignments key on it).
func TestImportRestoresOrganizationIntoExistingOrganization(t *testing.T) {
	dbConn := setupTestDB(t)
	ctx := t.Context()

	orgID := uuid.MustParse("00000000-0000-0000-0000-0000000000aa")
	require.NoError(t, dbConn.Create(&model.Organization{
		ID:          orgID,
		CustomID:    "existing-org",
		DisplayName: "Old Name",
		StartMonth:  time.January,
	}).Error)

	doc := &Document{
		Version: Version,
		Organizations: []Organization{{
			DisplayName: "New Name",
			StartMonth:  9,
		}},
	}

	require.NoError(t, ImportDocument(ctx, dbConn, orgID, doc))

	var org model.Organization
	require.NoError(t, dbConn.Where("id = ?", orgID).First(&org).Error)
	require.Equal(t, "New Name", org.DisplayName)
	require.EqualValues(t, 9, org.StartMonth)
	require.Equal(t, "existing-org", org.CustomID, "existing custom ID must be preserved")

	var orgAudits int64
	require.NoError(t, dbConn.Model(&model.AuditLogEntry{}).
		Where("resource_name = ? AND action = ?", "organizations/existing-org", "UPDATE").
		Count(&orgAudits).Error)
	require.EqualValues(t, 1, orgAudits)
}

// TestImportCreatesOrganizationWithDefaults imports a document whose
// organization element carries no details into a not yet existing target
// organization: a bare organization is created so the data has a home.
func TestImportCreatesOrganizationWithDefaults(t *testing.T) {
	dbConn := setupTestDB(t)

	orgID := uuid.MustParse("00000000-0000-0000-0000-0000000000bb")
	doc := &Document{
		Version: Version,
		Organizations: []Organization{{
			Accounts: []Account{
				{ID: "10000000-0000-0000-0000-000000000001", DisplayName: "Root"},
			},
		}},
	}

	require.NoError(t, ImportDocument(t.Context(), dbConn, orgID, doc))

	var org model.Organization
	require.NoError(t, dbConn.Where("id = ?", orgID).First(&org).Error)
	require.Equal(t, orgID.String(), org.CustomID)
	require.EqualValues(t, 1, org.StartMonth)
}

func TestImportRejectsInvalidStartMonth(t *testing.T) {
	dbConn := setupTestDB(t)

	orgID := uuid.MustParse("00000000-0000-0000-0000-0000000000cc")
	doc := &Document{
		Version: Version,
		Organizations: []Organization{{
			DisplayName: "X",
			StartMonth:  13,
		}},
	}

	err := ImportDocument(t.Context(), dbConn, orgID, doc)
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid startMonth")
}

// TestImportNewOrganization verifies that importing a document as a new
// organization generates a fresh UUID, restores the document's organization
// details and data, and reports the created organization.
func TestImportNewOrganization(t *testing.T) {
	dbConn := setupTestDB(t)
	ctx := t.Context()

	docID := "00000000-0000-0000-0000-000000000001"
	doc := &Document{
		Version: Version,
		Organizations: []Organization{{
			ID:          docID,
			CustomID:    "imported-org",
			DisplayName: "Imported",
			StartMonth:  4,
			Accounts: []Account{
				{ID: "10000000-0000-0000-0000-000000000001", DisplayName: "Root"},
			},
		}},
	}

	org, err := ImportNewOrganization(ctx, dbConn, doc)
	require.NoError(t, err)
	require.NotEqual(t, docID, org.ID.String(), "a fresh organization UUID must be generated")
	require.Equal(t, "imported-org", org.CustomID)
	require.Equal(t, "Imported", org.DisplayName)
	require.EqualValues(t, 4, org.StartMonth)

	var accountCount int64
	require.NoError(t, dbConn.Model(&model.Account{}).Where("organization_id = ?", org.ID).Count(&accountCount).Error)
	require.EqualValues(t, 1, accountCount)

	var orgAudits int64
	require.NoError(t, dbConn.Model(&model.AuditLogEntry{}).
		Where("resource_name = ? AND action = ?", "organizations/imported-org", "CREATE").
		Count(&orgAudits).Error)
	require.EqualValues(t, 1, orgAudits)
}

// TestImportNewOrganizationCustomIDConflict verifies that a document whose
// customId is already taken is rejected before anything is written.
func TestImportNewOrganizationCustomIDConflict(t *testing.T) {
	dbConn := setupTestDB(t)
	ctx := t.Context()

	require.NoError(t, dbConn.Create(&model.Organization{
		ID:       uuid.MustParse("00000000-0000-0000-0000-0000000000dd"),
		CustomID: "taken",
	}).Error)

	doc := &Document{
		Version: Version,
		Organizations: []Organization{{
			CustomID:    "taken",
			DisplayName: "Duplicate",
			Accounts: []Account{
				{ID: "10000000-0000-0000-0000-000000000001", DisplayName: "Root"},
			},
		}},
	}

	_, err := ImportNewOrganization(ctx, dbConn, doc)
	require.ErrorIs(t, err, ErrOrganizationCustomIDTaken)

	var accountCount int64
	require.NoError(t, dbConn.Model(&model.Account{}).Count(&accountCount).Error)
	require.EqualValues(t, 0, accountCount, "no data must be written on conflict")
}
