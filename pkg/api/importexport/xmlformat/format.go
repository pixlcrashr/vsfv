package xmlformat

import (
	"encoding/xml"
	"time"
)

// Version is the XML import/export format version implemented by this package.
const Version = 1

// Document is the top-level XML import/export document.
type Document struct {
	XMLName xml.Name `xml:"vsfvExport"`
	// Version identifies the format version. Must be 1.
	Version int `xml:"version,attr"`
	// ExportedAt is the RFC 3339 timestamp of the export. Ignored on import.
	ExportedAt string `xml:"exportedAt,attr,omitempty"`

	// Organizations contains the exported organizations, each carrying all of
	// their data. The structure supports any number of organizations in
	// theory; the current implementation exports and imports exactly one
	// organization per file.
	Organizations []Organization `xml:"organizations>organization,omitempty"`
}

// Organization represents one exported organization: its record details plus
// all of its data. The ID and custom ID are informational on import: data is
// always restored into the target organization chosen by the caller. Users and
// (user) groups — including their organization assignments — are never part of
// the export because they are not owned by the organization.
type Organization struct {
	ID                 string `xml:"id,attr,omitempty"`
	CustomID           string `xml:"customId,attr,omitempty"`
	DisplayName        string `xml:"displayName,attr"`
	DisplayDescription string `xml:"displayDescription,attr,omitempty"`
	// StartMonth is the ledger year start month (1 = January … 12 = December).
	// Zero means unspecified; imports fall back to January.
	StartMonth int `xml:"startMonth,attr"`

	Accounts       []Account       `xml:"accounts>account"`
	AccountGroups  []AccountGroup  `xml:"accountGroups>accountGroup"`
	LedgerAccounts []LedgerAccount `xml:"ledgerAccounts>ledgerAccount"`
	LedgerYears    []LedgerYear    `xml:"ledgerYears>ledgerYear"`
	Budgets        []Budget        `xml:"budgets>budget"`
	Transactions   []Transaction   `xml:"transactions>transaction"`
}

// Account represents a single account node in the recursive tree.
type Account struct {
	ID                 string    `xml:"id,attr"`
	CustomID           string    `xml:"customId,attr,omitempty"`
	ParentAccountID    string    `xml:"parentAccountId,attr,omitempty"`
	DisplayName        string    `xml:"displayName,attr"`
	DisplayCode        string    `xml:"displayCode,attr,omitempty"`
	DisplayDescription string    `xml:"displayDescription,attr,omitempty"`
	IsContainer        bool      `xml:"isContainer,attr"`
	IsArchived         bool      `xml:"isArchived,attr"`
	Children           []Account `xml:"children>account"`
}

// AccountGroup represents a group of accounts and their mappings.
type AccountGroup struct {
	ID                 string                   `xml:"id,attr"`
	CustomID           string                   `xml:"customId,attr,omitempty"`
	DisplayName        string                   `xml:"displayName,attr"`
	DisplayDescription string                   `xml:"displayDescription,attr,omitempty"`
	Assignments        []AccountGroupAssignment `xml:"accountGroupAssignments>accountGroupAssignment"`
}

// AccountGroupAssignment maps an account into an account group.
type AccountGroupAssignment struct {
	AccountID string `xml:"accountId,attr"`
	Negate    bool   `xml:"negate,attr"`
}

// LedgerAccount represents an account used for double-entry transactions.
type LedgerAccount struct {
	ID                 string `xml:"id,attr"`
	CustomID           string `xml:"customId,attr,omitempty"`
	Code               string `xml:"code,attr"`
	AccountType        string `xml:"accountType,attr,omitempty"`
	DisplayName        string `xml:"displayName,attr"`
	DisplayDescription string `xml:"displayDescription,attr,omitempty"`
}

// LedgerYear represents a fiscal/ledger year.
type LedgerYear struct {
	ID       string `xml:"id,attr"`
	CustomID string `xml:"customId,attr,omitempty"`
	Year     int    `xml:"year,attr"`
	IsClosed bool   `xml:"isClosed,attr"`
}

// Budget represents a budget with base values and revisions.
type Budget struct {
	ID                  string           `xml:"id,attr"`
	CustomID            string           `xml:"customId,attr,omitempty"`
	DisplayName         string           `xml:"displayName,attr"`
	DisplayDescription  string           `xml:"displayDescription,attr,omitempty"`
	PeriodStart         string           `xml:"periodStart,attr"`
	PeriodEnd           string           `xml:"periodEnd,attr"`
	IsClosed            bool             `xml:"isClosed,attr"`
	IsPublished         bool             `xml:"isPublished,attr"`
	PublishActualValues bool             `xml:"publishActualValues,attr"`
	AccountValues       []BudgetValue    `xml:"accountValues>accountValue"`
	Revisions           []BudgetRevision `xml:"budgetRevisions>budgetRevision"`
}

// BudgetValue is a single planned value for a budget account.
type BudgetValue struct {
	AccountID string `xml:"accountId,attr"`
	Value     string `xml:"value,attr"`
}

// BudgetRevision represents a single amendment of a budget.
type BudgetRevision struct {
	ID                 string        `xml:"id,attr"`
	CustomID           string        `xml:"customId,attr,omitempty"`
	DisplayName        string        `xml:"displayName,attr,omitempty"`
	DisplayDescription string        `xml:"displayDescription,attr,omitempty"`
	Date               string        `xml:"date,attr"`
	AccountValues      []BudgetValue `xml:"accountValues>accountValue"`
}

// Transaction represents a journal entry.
type Transaction struct {
	ID                    string                  `xml:"id,attr"`
	CustomID              string                  `xml:"customId,attr,omitempty"`
	CreditLedgerAccountID string                  `xml:"creditLedgerAccountId,attr"`
	DebitLedgerAccountID  string                  `xml:"debitLedgerAccountId,attr"`
	Amount                string                  `xml:"amount,attr"`
	Description           string                  `xml:"description,attr,omitempty"`
	Reference             string                  `xml:"reference,attr,omitempty"`
	BookedAt              string                  `xml:"bookedAt,attr"`
	DocumentDate          string                  `xml:"documentDate,attr"`
	AssignedAccountID     string                  `xml:"assignedAccountId,attr,omitempty"`
	Assignments           []TransactionAssignment `xml:"transactionAssignments>transactionAssignment"`
}

// TransactionAssignment assigns a portion of a transaction to a budget account.
type TransactionAssignment struct {
	AccountID string `xml:"accountId,attr"`
	Value     string `xml:"value,attr"`
}

// Marshal encodes a document with a standard XML header.
func Marshal(doc *Document) ([]byte, error) {
	out, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, err
	}
	return append([]byte(xml.Header), out...), nil
}

// Unmarshal parses a document from XML bytes.
func Unmarshal(data []byte) (*Document, error) {
	var doc Document
	if err := xml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	return &doc, nil
}

// DateLayout is the date format used for all date fields (YYYY-MM-DD).
const DateLayout = "2006-01-02"

// FormatExportedAt returns the current UTC time in RFC 3339.
func FormatExportedAt() string {
	return time.Now().UTC().Format(time.RFC3339)
}
