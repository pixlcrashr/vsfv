// export-xml reads the legacy Prisma-based VSFV database (schema defined in
// prisma/schema.prisma in the old repository at github.com/pixlcrashr/vsfv_old,
// checked out at D:\git\github.com\pixlcrashr\vsfv_old) and produces an XML
// document matching the current import/export format
// (pkg/api/importexport/xmlformat).
//
// Old-to-new schema mapping
// -------------------------
//
// (none) → <organizations><organization>
//
//	The old schema is single-tenant and has no organization record. The tool
//	emits exactly one <organization> element carrying the display name passed
//	on the command line (defaulting to the legacy application name) and a
//	January start month; all other sections are nested inside it. The format
//	supports multiple organizations per file in theory, but exactly one is
//	emitted. The id is left empty: on import the organization is restored into
//	the caller-chosen target organization, and the element's id is
//	informational only. Users and groups are never exported.
//
// accounts → <accounts><account>
//
//	Flat table with self-referencing parent_account_id. Nested recursively in XML.
//	Sorted by display_code to match the old NodeSort.Code behaviour
//	(src/lib/accounts/tree.ts). is_container is derived from whether an account
//	has children. The old schema has no is_container column.
//
// account_groups → <accountGroups><accountGroup>
//
//	account_group_assignments → <accountGroupAssignments><accountGroupAssignment>
//	account_id references accounts.id (budget accounts), NOT transaction_accounts.
//
// transaction_accounts → <ledgerAccounts><ledgerAccount>
//
//	These are the debit/credit ledger accounts for double-entry transactions.
//	The old schema has no account_type column; all are exported as "unspecified".
//	import_source_id is intentionally dropped — the XML format has no import-source
//	entity and is a portable planning image, not a full database clone.
//
// import_source_periods → <ledgerYears><ledgerYear>
//
//	Each import_source has its own set of periods (one per year) with an is_closed
//	flag. Every period row is exported as a separate <ledgerYear> because each
//	import source can independently have a closed/open state for the same year.
//	The importer is expected to deduplicate by year on the target side.
//
// budgets → <budgets><budget>
//
//	The old schema has NO base budget account values — only budget_revisions have
//	budget_revision_account_values. is_published and publish_actual_values default
//	to false because those columns do not exist in the old schema.
//
// budget_revisions → <budgetRevisions><budgetRevision>
//
//	The old schema has no display_name column, so revisions are exported without
//	displayName; the importer falls back to the revision date as the name.
//	budget_revision_account_values → <accountValues><accountValue>
//	The old schema has no unique constraint on (budget_revision_id, account_id);
//	duplicate rows are consolidated by summing their values.
//
// transactions → <transactions><transaction>
//
//	credit_transaction_account_id and debit_transaction_account_id reference
//	transaction_accounts.id (mapped to ledgerAccounts in XML).
//	custom_id is a composite deduplication key built from bookedAt, documentDate,
//	creditAccount, debitAccount, amount, reference, and description.
//	assigned_account_id is the legacy/simple budget account assignment. The old
//	journal UI (src/routes/journal/index@menu.tsx) falls back to this column
//	whenever a transaction has no transaction_account_assignments rows, treating
//	the whole transaction amount as assigned to that account. The exporter mirrors
//	that behaviour: explicit transaction_account_assignments are exported first;
//	only when none exist is assigned_account_id used.
//	transaction_account_assignments → <transactionAssignments><transactionAssignment>
//	account_id references accounts.id (budget accounts). The old schema has no
//	unique constraint on (transaction_id, account_id); duplicate rows are
//	consolidated by summing their values.
package main

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/lib/pq"

	"github.com/pixlcrashr/vsfv/pkg/api/importexport/xmlformat"
)

// defaultOrganizationDisplayName is used for the <organization> element when
// the caller does not provide one. The legacy schema is single-tenant and has
// no organization record to take a name from.
const defaultOrganizationDisplayName = "VS Finanzverwaltung"

func main() {
	if len(os.Args) < 4 || len(os.Args) > 5 {
		fmt.Fprintln(os.Stderr, "Usage: export-xml <postgres-dsn> <schema> <output.xml> [organization-display-name]")
		fmt.Fprintln(os.Stderr, "Example: export-xml postgres://user:pass@localhost/olddb?sslmode=disable public output.xml \"Mein Verein\"")
		os.Exit(1)
	}

	dsn := os.Args[1]
	schema := os.Args[2]
	outPath := os.Args[3]
	orgDisplayName := defaultOrganizationDisplayName
	if len(os.Args) == 5 {
		orgDisplayName = os.Args[4]
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		fmt.Fprintf(os.Stderr, "ping database: %v\n", err)
		os.Exit(1)
	}

	doc, err := exportOldSchema(db, schema, orgDisplayName)
	if err != nil {
		fmt.Fprintf(os.Stderr, "export: %v\n", err)
		os.Exit(1)
	}

	data, err := xmlformat.Marshal(doc)
	if err != nil {
		fmt.Fprintf(os.Stderr, "marshal xml: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(outPath, data, 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "write file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Exported old schema to %s\n", outPath)
}

// exportOldSchema reads the legacy Prisma schema (as defined in vsfv_public.sql)
// and maps it to the current XML import/export format. The old schema is
// single-tenant and has no organization record, so the exported document
// carries exactly one <organization> element (containing all data) built from
// orgDisplayName.
func exportOldSchema(db *sql.DB, schema, orgDisplayName string) (*xmlformat.Document, error) {
	doc := &xmlformat.Document{
		Version:    xmlformat.Version,
		ExportedAt: xmlformat.FormatExportedAt(),
		Organizations: []xmlformat.Organization{{
			DisplayName: orgDisplayName,
			StartMonth:  1,
		}},
	}
	org := &doc.Organizations[0]

	accounts, err := loadAccounts(db, schema)
	if err != nil {
		return nil, fmt.Errorf("load accounts: %w", err)
	}
	org.Accounts = accounts

	groups, err := loadAccountGroups(db, schema)
	if err != nil {
		return nil, fmt.Errorf("load account groups: %w", err)
	}
	org.AccountGroups = groups

	// Load transactions before ledger accounts so we know exactly which
	// transaction_account IDs are referenced by journal entries. Some legacy data
	// references IDs that no longer exist in public.transaction_accounts, so the
	// ledger-account loader needs this set to emit placeholders.
	transactions, err := loadTransactions(db, schema)
	if err != nil {
		return nil, fmt.Errorf("load transactions: %w", err)
	}
	org.Transactions = transactions

	referencedLedgerAccountIDs := collectReferencedLedgerAccountIDs(transactions)

	// The old schema has no dedicated ledger_accounts table. transaction_accounts
	// fill the same role as debit/credit accounts for journal entries.
	ledgerAccounts, err := loadLedgerAccountsFromTransactionAccounts(db, schema, referencedLedgerAccountIDs)
	if err != nil {
		return nil, fmt.Errorf("load ledger accounts: %w", err)
	}
	org.LedgerAccounts = ledgerAccounts

	// The old schema has no ledger_years table. import_source_periods contain a
	// year and is_closed flag; every period row is exported as a ledger year.
	ledgerYears, err := loadLedgerYearsFromImportSourcePeriods(db, schema)
	if err != nil {
		return nil, fmt.Errorf("load ledger years: %w", err)
	}
	org.LedgerYears = ledgerYears

	budgets, err := loadBudgets(db, schema)
	if err != nil {
		return nil, fmt.Errorf("load budgets: %w", err)
	}
	org.Budgets = budgets

	return doc, nil
}

// loadAccounts reads public.accounts. The old schema stores accounts in a flat
// table with a self-referencing parent_account_id; child accounts are nested
// recursively in the XML. Accounts are sorted by display_code to match the old
// NodeSort.Code behaviour in src/lib/accounts/tree.ts.
func loadAccounts(db *sql.DB, schema string) ([]xmlformat.Account, error) {
	// Old accounts columns: id, parent_account_id, display_name, display_code,
	// display_description, updated_at, created_at, is_archived.
	rows, err := db.Query(fmt.Sprintf(`
		SELECT id, parent_account_id, display_name, display_code, display_description, is_archived
		FROM %s.accounts
		ORDER BY display_code
	`, schema))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type accountInfo struct {
		ID                 string
		ParentAccountID    string
		DisplayName        string
		DisplayCode        string
		DisplayDescription string
		IsArchived         bool
	}

	byID := make(map[string]*accountInfo)
	children := make(map[string][]string)
	var rootIDs []string

	for rows.Next() {
		var id, displayName, displayCode, displayDescription string
		var parentAccountID sql.NullString
		var isArchived bool
		if err := rows.Scan(&id, &parentAccountID, &displayName, &displayCode, &displayDescription, &isArchived); err != nil {
			return nil, err
		}
		info := accountInfo{
			ID:                 id,
			DisplayName:        displayName,
			DisplayCode:        displayCode,
			DisplayDescription: displayDescription,
			IsArchived:         isArchived,
		}
		if parentAccountID.Valid {
			info.ParentAccountID = parentAccountID.String
			children[info.ParentAccountID] = append(children[info.ParentAccountID], id)
		} else {
			rootIDs = append(rootIDs, id)
		}
		byID[id] = &info
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var build func(string) xmlformat.Account
	build = func(id string) xmlformat.Account {
		info := byID[id]
		acc := xmlformat.Account{
			ID:                 info.ID,
			CustomID:           info.ID,
			DisplayName:        info.DisplayName,
			DisplayCode:        info.DisplayCode,
			DisplayDescription: info.DisplayDescription,
			IsContainer:        false,
			IsArchived:         info.IsArchived,
		}
		if info.ParentAccountID != "" {
			acc.ParentAccountID = info.ParentAccountID
		}
		for _, childID := range children[id] {
			acc.Children = append(acc.Children, build(childID))
		}
		acc.IsContainer = len(acc.Children) > 0
		return acc
	}

	// Detect cycles: any account not reachable from roots should still be exported
	// as a root to avoid data loss, and a warning is printed to stderr.
	reachable := make(map[string]bool)
	var markReachable func(string)
	markReachable = func(id string) {
		if reachable[id] {
			return
		}
		reachable[id] = true
		for _, childID := range children[id] {
			markReachable(childID)
		}
	}
	for _, id := range rootIDs {
		markReachable(id)
	}
	for id := range byID {
		if !reachable[id] {
			fmt.Fprintf(os.Stderr, "warning: account %s is part of a cycle or has an unknown parent, exporting as root\n", id)
			rootIDs = append(rootIDs, id)
		}
	}

	var result []xmlformat.Account
	for _, id := range rootIDs {
		result = append(result, build(id))
	}
	return result, nil
}

// loadAccountGroups reads public.account_groups and public.account_group_assignments.
func loadAccountGroups(db *sql.DB, schema string) ([]xmlformat.AccountGroup, error) {
	rows, err := db.Query(fmt.Sprintf(`
		SELECT id, display_name, display_description
		FROM %s.account_groups
		ORDER BY created_at
	`, schema))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []xmlformat.AccountGroup
	for rows.Next() {
		var g xmlformat.AccountGroup
		if err := rows.Scan(&g.ID, &g.DisplayName, &g.DisplayDescription); err != nil {
			return nil, err
		}
		g.CustomID = g.ID
		groups = append(groups, g)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Build the lookup map only after all appends are done so the pointers stay
	// valid even if the groups slice was reallocated while growing.
	byID := make(map[string]*xmlformat.AccountGroup, len(groups))
	for i := range groups {
		byID[groups[i].ID] = &groups[i]
	}

	assignRows, err := db.Query(fmt.Sprintf(`
		SELECT account_group_id, account_id, negate
		FROM %s.account_group_assignments
	`, schema))
	if err != nil {
		return nil, err
	}
	defer assignRows.Close()

	for assignRows.Next() {
		var groupID string
		var a xmlformat.AccountGroupAssignment
		if err := assignRows.Scan(&groupID, &a.AccountID, &a.Negate); err != nil {
			return nil, err
		}
		if g, ok := byID[groupID]; ok {
			g.Assignments = append(g.Assignments, a)
		}
	}
	if err := assignRows.Err(); err != nil {
		return nil, err
	}

	return groups, nil
}

// collectReferencedLedgerAccountIDs returns the set of credit/debit ledger
// account IDs used by the exported transactions.
func collectReferencedLedgerAccountIDs(transactions []xmlformat.Transaction) map[string]struct{} {
	refs := make(map[string]struct{})
	for _, t := range transactions {
		if t.CreditLedgerAccountID != "" {
			refs[t.CreditLedgerAccountID] = struct{}{}
		}
		if t.DebitLedgerAccountID != "" {
			refs[t.DebitLedgerAccountID] = struct{}{}
		}
	}
	return refs
}

// loadLedgerAccountsFromTransactionAccounts maps public.transaction_accounts to
// <ledgerAccount> elements. The old schema has no account_type column, so every
// account is exported with type "unspecified". Any IDs in required that are not
// present in public.transaction_accounts are emitted as placeholder ledger
// accounts so that transaction references remain resolvable in the new schema.
func loadLedgerAccountsFromTransactionAccounts(db *sql.DB, schema string, required map[string]struct{}) ([]xmlformat.LedgerAccount, error) {
	// Old transaction_accounts columns: id, code, display_name, display_description,
	// updated_at, created_at, import_source_id. import_source_id is dropped because
	// the XML format does not preserve organization-scoped references.
	rows, err := db.Query(fmt.Sprintf(`
		SELECT id, code, display_name, display_description
		FROM %s.transaction_accounts
		ORDER BY code
	`, schema))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	seen := make(map[string]struct{})
	var result []xmlformat.LedgerAccount
	for rows.Next() {
		var id, code, displayName, displayDescription string
		if err := rows.Scan(&id, &code, &displayName, &displayDescription); err != nil {
			return nil, err
		}
		seen[id] = struct{}{}
		result = append(result, xmlformat.LedgerAccount{
			ID:                 id,
			CustomID:           id,
			Code:               code,
			AccountType:        "unspecified",
			DisplayName:        displayName,
			DisplayDescription: displayDescription,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for id := range required {
		if _, ok := seen[id]; ok {
			continue
		}
		fmt.Fprintf(os.Stderr, "warning: transaction references missing transaction_account %s; emitting placeholder ledger account\n", id)
		result = append(result, xmlformat.LedgerAccount{
			ID:                 id,
			CustomID:           id,
			Code:               id,
			AccountType:        "unspecified",
			DisplayName:        "",
			DisplayDescription: "",
		})
	}
	return result, nil
}

// loadLedgerYearsFromImportSourcePeriods derives <ledgerYear> entries from
// public.import_source_periods. The old schema has no global ledger_years table;
// each import source has its own set of periods (one per year) with an is_closed
// flag. Every period row is exported as a separate <ledgerYear> because each
// import source can independently have a closed/open state for the same year.
// The importer is expected to deduplicate by year on the target side.
func loadLedgerYearsFromImportSourcePeriods(db *sql.DB, schema string) ([]xmlformat.LedgerYear, error) {
	rows, err := db.Query(fmt.Sprintf(`
		SELECT id, year, is_closed
		FROM %s.import_source_periods
		ORDER BY year, created_at
	`, schema))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []xmlformat.LedgerYear
	for rows.Next() {
		var id string
		var year int
		var isClosed bool
		if err := rows.Scan(&id, &year, &isClosed); err != nil {
			return nil, err
		}
		result = append(result, xmlformat.LedgerYear{
			ID:       id,
			CustomID: id,
			Year:     year,
			IsClosed: isClosed,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

// loadBudgets reads public.budgets, public.budget_revisions and
// public.budget_revision_account_values. The old schema has no base budget account
// values, only revision values. budget_revisions has no display_name column; the
// revisions are exported without displayName and the importer falls back to the
// revision date.
func loadBudgets(db *sql.DB, schema string) ([]xmlformat.Budget, error) {
	bRows, err := db.Query(fmt.Sprintf(`
		SELECT id, display_name, display_description, is_closed, period_start, period_end
		FROM %s.budgets
		ORDER BY created_at, id
	`, schema))
	if err != nil {
		return nil, err
	}
	defer bRows.Close()

	var budgets []xmlformat.Budget
	for bRows.Next() {
		var id, displayName, displayDescription string
		var isClosed bool
		var periodStart, periodEnd time.Time
		if err := bRows.Scan(&id, &displayName, &displayDescription, &isClosed, &periodStart, &periodEnd); err != nil {
			return nil, err
		}
		budgets = append(budgets, xmlformat.Budget{
			ID:                  id,
			CustomID:            id,
			DisplayName:         displayName,
			DisplayDescription:  displayDescription,
			IsClosed:            isClosed,
			IsPublished:         false,
			PublishActualValues: false,
			PeriodStart:         periodStart.Format(xmlformat.DateLayout),
			PeriodEnd:           periodEnd.Format(xmlformat.DateLayout),
		})
	}
	if err := bRows.Err(); err != nil {
		return nil, err
	}

	// Revisions are collected in a flat slice with the owning budget id kept in a
	// parallel slice; they are grouped into budgets only after all account values
	// have been attached. Storing pointers into the revisions slice while it is
	// still growing would leave dangling pointers after reallocation.
	rRows, err := db.Query(fmt.Sprintf(`
		SELECT id, budget_id, date, display_description
		FROM %s.budget_revisions
		ORDER BY date, created_at, id
	`, schema))
	if err != nil {
		return nil, err
	}
	defer rRows.Close()

	var revisions []xmlformat.BudgetRevision
	var revisionBudgetIDs []string
	for rRows.Next() {
		var id, budgetID, displayDescription string
		var date time.Time
		if err := rRows.Scan(&id, &budgetID, &date, &displayDescription); err != nil {
			return nil, err
		}
		revisions = append(revisions, xmlformat.BudgetRevision{
			ID:                 id,
			CustomID:           id,
			DisplayDescription: displayDescription,
			Date:               date.Format(xmlformat.DateLayout),
		})
		revisionBudgetIDs = append(revisionBudgetIDs, budgetID)
	}
	if err := rRows.Err(); err != nil {
		return nil, err
	}

	revByID := make(map[string]*xmlformat.BudgetRevision, len(revisions))
	for i := range revisions {
		revByID[revisions[i].ID] = &revisions[i]
	}

	// The old schema has no unique constraint on (budget_revision_id, account_id)
	// while the new schema does. Duplicate rows are consolidated by summing their
	// values, mirroring the transaction_assignments consolidation migration.
	vRows, err := db.Query(fmt.Sprintf(`
		SELECT budget_revision_id, account_id, SUM(value)
		FROM %s.budget_revision_account_values
		GROUP BY budget_revision_id, account_id
		ORDER BY MIN(created_at), MIN(id::text)
	`, schema))
	if err != nil {
		return nil, err
	}
	defer vRows.Close()

	for vRows.Next() {
		var revID, accountID, value string
		if err := vRows.Scan(&revID, &accountID, &value); err != nil {
			return nil, err
		}
		if rev, ok := revByID[revID]; ok {
			rev.AccountValues = append(rev.AccountValues, xmlformat.BudgetValue{
				AccountID: accountID,
				Value:     value,
			})
		}
	}
	if err := vRows.Err(); err != nil {
		return nil, err
	}

	revisionsByBudget := make(map[string][]xmlformat.BudgetRevision)
	for i := range revisions {
		budgetID := revisionBudgetIDs[i]
		revisionsByBudget[budgetID] = append(revisionsByBudget[budgetID], revisions[i])
	}
	for i := range budgets {
		budgets[i].Revisions = revisionsByBudget[budgets[i].ID]
	}

	return budgets, nil
}

// loadTransactions reads public.transactions and public.transaction_account_assignments.
// Old transactions reference transaction_accounts via credit_transaction_account_id
// and debit_transaction_account_id; those IDs are used as ledger-account IDs in the XML.
// assigned_account_id is the legacy/simple budget account assignment. The old journal UI
// (src/routes/journal/index@menu.tsx) falls back to this column whenever a transaction has
// no transaction_account_assignments rows. The exporter mirrors that behaviour: explicit
// assignments are exported first; only when none exist is assigned_account_id used to
// create a single assignment with the full transaction amount.
func loadTransactions(db *sql.DB, schema string) ([]xmlformat.Transaction, error) {
	tRows, err := db.Query(fmt.Sprintf(`
		SELECT id, custom_id, credit_transaction_account_id, debit_transaction_account_id,
		       amount, description, reference, assigned_account_id, booked_at, document_date
		FROM %s.transactions
		ORDER BY document_date, booked_at, id
	`, schema))
	if err != nil {
		return nil, err
	}
	defer tRows.Close()

	var transactions []xmlformat.Transaction
	for tRows.Next() {
		var id, customID, creditID, debitID, amount, description, reference string
		var assignedAccountID sql.NullString
		var bookedAt, documentDate time.Time
		if err := tRows.Scan(&id, &customID, &creditID, &debitID, &amount, &description, &reference,
			&assignedAccountID, &bookedAt, &documentDate); err != nil {
			return nil, err
		}

		tx := xmlformat.Transaction{
			ID:                    id,
			CustomID:              customID,
			CreditLedgerAccountID: creditID,
			DebitLedgerAccountID:  debitID,
			Amount:                amount,
			Description:           description,
			Reference:             reference,
			BookedAt:              bookedAt.Format(xmlformat.DateLayout),
			DocumentDate:          documentDate.Format(xmlformat.DateLayout),
		}
		if assignedAccountID.Valid {
			tx.AssignedAccountID = assignedAccountID.String
		}
		if tx.CustomID == "" {
			tx.CustomID = id
		}

		transactions = append(transactions, tx)
	}
	if err := tRows.Err(); err != nil {
		return nil, err
	}

	// Build the lookup map only after all transactions are appended so the pointers
	// remain valid even if the slice was reallocated while growing.
	byID := make(map[string]*xmlformat.Transaction, len(transactions))
	for i := range transactions {
		byID[transactions[i].ID] = &transactions[i]
	}

	// The old schema has no unique constraint on (transaction_id, account_id)
	// while the new schema does. Duplicate rows are consolidated by summing their
	// values, mirroring the consolidation migration performed on the new schema.
	aRows, err := db.Query(fmt.Sprintf(`
		SELECT transaction_id, account_id, SUM(value)
		FROM %s.transaction_account_assignments
		GROUP BY transaction_id, account_id
		ORDER BY MIN(created_at), MIN(id::text)
	`, schema))
	if err != nil {
		return nil, err
	}
	defer aRows.Close()

	for aRows.Next() {
		var txID, accountID, value string
		if err := aRows.Scan(&txID, &accountID, &value); err != nil {
			return nil, err
		}
		if tx, ok := byID[txID]; ok {
			tx.Assignments = append(tx.Assignments, xmlformat.TransactionAssignment{
				AccountID: accountID,
				Value:     value,
			})
		}
	}
	if err := aRows.Err(); err != nil {
		return nil, err
	}

	// Mirror the old journal UI fallback: when no explicit assignments exist,
	// the whole transaction amount is considered assigned to assigned_account_id.
	for i := range transactions {
		tx := &transactions[i]
		if len(tx.Assignments) == 0 && tx.AssignedAccountID != "" {
			tx.Assignments = append(tx.Assignments, xmlformat.TransactionAssignment{
				AccountID: tx.AssignedAccountID,
				Value:     tx.Amount,
			})
		}
	}

	return transactions, nil
}
