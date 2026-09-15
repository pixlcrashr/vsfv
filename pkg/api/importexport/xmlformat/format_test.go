package xmlformat

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func sampleOrganization() Organization {
	return Organization{
		ID:          "00000000-0000-0000-0000-000000000001",
		CustomID:    "mein-verein",
		DisplayName: "Mein Verein e.V.",
		StartMonth:  1,
		Accounts: []Account{
			{
				ID:          "11111111-1111-1111-1111-111111111111",
				DisplayName: "Root",
				Children: []Account{
					{
						ID:              "22222222-2222-2222-2222-222222222222",
						ParentAccountID: "11111111-1111-1111-1111-111111111111",
						DisplayName:     "Child",
					},
				},
			},
		},
		AccountGroups: []AccountGroup{
			{
				ID:          "33333333-3333-3333-3333-333333333333",
				DisplayName: "Group",
				Assignments: []AccountGroupAssignment{
					{AccountID: "22222222-2222-2222-2222-222222222222", Negate: true},
				},
			},
		},
		LedgerAccounts: []LedgerAccount{
			{
				ID:          "44444444-4444-4444-4444-444444444444",
				Code:        "1000",
				AccountType: "asset",
				DisplayName: "Bank",
			},
		},
		LedgerYears: []LedgerYear{
			{ID: "55555555-5555-5555-5555-555555555555", Year: 2026, IsClosed: false},
		},
		Budgets: []Budget{
			{
				ID:          "66666666-6666-6666-6666-666666666666",
				DisplayName: "Budget",
				PeriodStart: "2026-01-01",
				PeriodEnd:   "2026-12-31",
				AccountValues: []BudgetValue{
					{AccountID: "22222222-2222-2222-2222-222222222222", Value: "1500.00"},
				},
				Revisions: []BudgetRevision{
					{
						ID:   "77777777-7777-7777-7777-777777777777",
						Date: "2026-03-15",
						AccountValues: []BudgetValue{
							{AccountID: "22222222-2222-2222-2222-222222222222", Value: "200.00"},
						},
					},
				},
			},
		},
		Transactions: []Transaction{
			{
				ID:                    "88888888-8888-8888-8888-888888888888",
				CreditLedgerAccountID: "44444444-4444-4444-4444-444444444444",
				DebitLedgerAccountID:  "44444444-4444-4444-4444-444444444444",
				Amount:                "120.50",
				BookedAt:              "2026-01-15",
				DocumentDate:          "2026-01-15",
				Assignments: []TransactionAssignment{
					{AccountID: "22222222-2222-2222-2222-222222222222", Value: "120.50"},
				},
			},
		},
	}
}

func TestMarshalUnmarshalRoundtrip(t *testing.T) {
	doc := &Document{
		Version:       Version,
		ExportedAt:    "2026-09-02T12:00:00Z",
		Organizations: []Organization{sampleOrganization()},
	}

	data, err := Marshal(doc)
	require.NoError(t, err)
	require.Contains(t, string(data), `<vsfvExport version="1" exportedAt="2026-09-02T12:00:00Z">`)
	require.Contains(t, string(data), `<organizations>`)

	got, err := Unmarshal(data)
	require.NoError(t, err)
	require.Equal(t, Version, got.Version)
	require.Equal(t, doc.ExportedAt, got.ExportedAt)
	require.Len(t, got.Organizations, 1)

	org := got.Organizations[0]
	require.Equal(t, "00000000-0000-0000-0000-000000000001", org.ID)
	require.Equal(t, "mein-verein", org.CustomID)
	require.Equal(t, "Mein Verein e.V.", org.DisplayName)
	require.Equal(t, 1, org.StartMonth)
	require.Len(t, org.Accounts, 1)
	require.Len(t, org.Accounts[0].Children, 1)
	require.Len(t, org.AccountGroups, 1)
	require.Len(t, org.AccountGroups[0].Assignments, 1)
	require.True(t, org.AccountGroups[0].Assignments[0].Negate)
	require.Len(t, org.LedgerAccounts, 1)
	require.Equal(t, "asset", org.LedgerAccounts[0].AccountType)
	require.Len(t, org.Budgets, 1)
	require.Len(t, org.Budgets[0].Revisions, 1)
	require.Len(t, org.Transactions, 1)
	require.Len(t, org.Transactions[0].Assignments, 1)
}

// TestUnmarshalMultipleOrganizations verifies that the format structure itself
// supports several organizations per file, even though import currently
// accepts exactly one.
func TestUnmarshalMultipleOrganizations(t *testing.T) {
	doc := &Document{
		Version: Version,
		Organizations: []Organization{
			{ID: "00000000-0000-0000-0000-000000000001", DisplayName: "One"},
			{ID: "00000000-0000-0000-0000-000000000002", DisplayName: "Two"},
		},
	}

	got, err := Unmarshal(mustMarshal(t, doc))
	require.NoError(t, err)
	require.Len(t, got.Organizations, 2)
	require.Equal(t, "One", got.Organizations[0].DisplayName)
	require.Equal(t, "Two", got.Organizations[1].DisplayName)
}

// TestUnmarshalLegacyFlatDocument verifies that version 1 documents using the
// old flat layout (data sections directly under vsfvExport, no organization
// wrapper) still parse; they carry no organization and are rejected by
// ImportDocument.
func TestUnmarshalLegacyFlatDocument(t *testing.T) {
	data := []byte(`<?xml version="1.0" encoding="UTF-8"?>
<vsfvExport version="1">
  <accounts>
    <account id="11111111-1111-1111-1111-111111111111" displayName="Root"/>
  </accounts>
</vsfvExport>`)
	got, err := Unmarshal(data)
	require.NoError(t, err)
	require.Empty(t, got.Organizations)
}

func mustMarshal(t *testing.T, doc *Document) []byte {
	t.Helper()
	data, err := Marshal(doc)
	require.NoError(t, err)
	return data
}
