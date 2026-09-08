package authz

import "strings"

// Permission encodes a resource/action pair used by casbin policies.
type Permission struct {
	Resource string
	Action   string
}

// String returns the permission in "resource:action" format.
func (p Permission) String() string {
	return p.Resource + ":" + p.Action
}

// ParsePermission parses a "resource:action" string into a Permission.
// Returns the zero value and false if the string is not in the expected format.
func ParsePermission(s string) (Permission, bool) {
	idx := strings.Index(s, ":")
	if idx < 0 || idx == len(s)-1 {
		return Permission{}, false
	}
	return Permission{Resource: s[:idx], Action: s[idx+1:]}, true
}

// Resources used in casbin policies.
const (
	ResourceDashboard       = "dashboard"
	ResourceAccounts        = "accounts"
	ResourceAccountGroups   = "accountGroups"
	ResourceBudgets         = "budgets"
	ResourceJournal         = "journal"
	ResourceLedgerAccount   = "ledgerAccount"
	ResourceLedgerYear      = "ledgerYear"
	ResourceTransactions    = "transactions"
	ResourceMatrix          = "matrix"
	ResourceReports         = "reports"
	ResourceReportTemplates = "reportTemplates"
	ResourceImportSources   = "importSources"
	ResourceUsers           = "users"
	ResourceGroups          = "groups"
	ResourceSettings        = "settings"
	ResourceOrganizations   = "organizations"
	ResourceReimbursements  = "reimbursements"
	ResourceAuditLogs       = "auditLogs"
)

// Actions used in casbin policies.
const (
	ActionCreate     = "create"
	ActionRead       = "read"
	ActionUpdate     = "update"
	ActionDelete     = "delete"
	ActionImport     = "import"
	ActionArchive    = "archive"
	ActionRestore    = "restore"
	ActionClose      = "close"
	ActionComment    = "comment"
	ActionReadOwn    = "read_own"
	ActionCommentOwn = "comment_own"
	ActionUpdateOwn  = "update_own"
)

// GlobalDomain is the casbin domain value used for permissions that are not
// scoped to any organization (e.g. user management, group management, settings).
// Must be non-empty — the GORM adapter strips trailing empty strings from policy
// rows, which would corrupt g3 rules.
const GlobalDomain = "g"

// WildcardDomain is the casbin domain value used for wildcard organization
// assignments (g3). A group assigned to WildcardDomain has its permissions
// applied to every organization.
const WildcardDomain = "*"

// OrgDomainPrefix is the prefix for organization-scoped domains in casbin.
const OrgDomainPrefix = "organizations/"

// OrgDomain returns the casbin domain string for an organization-scoped
// resource, given the organization's custom ID. For example, an org with
// custom ID "acme" yields the domain "organizations/acme".
func OrgDomain(orgCustomID string) string {
	return OrgDomainPrefix + orgCustomID
}

// GlobalResources lists resources whose permissions are system-wide rather
// than organization-scoped. Policies for these resources use GlobalDomain.
var GlobalResources = map[string]bool{
	ResourceUsers:         true,
	ResourceGroups:        true,
	ResourceSettings:      true,
	ResourceOrganizations: true,
}
