package repository

import (
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"gorm.io/gorm"
)

// Factory constructs repositories on demand, all bound to a single database
// handle. Callers that need transactional consistency open a transaction
// (e.g. via db.Transact), build a Factory from the transaction handle, and
// request every repository they use from it, so all statements join the same
// transaction. enforcer may be nil when no UserGroup repository is requested.
type Factory struct {
	db       *gorm.DB
	enforcer *authz.Enforcer
}

// NewFactory returns a Factory whose repositories are bound to db, which may
// be the root *gorm.DB connection or an open transaction.
func NewFactory(db *gorm.DB, enforcer *authz.Enforcer) *Factory {
	return &Factory{db: db, enforcer: enforcer}
}

// Account returns an AccountRepository bound to the Factory's handle.
func (f *Factory) Account() *AccountRepository {
	return NewAccountRepository(f.db)
}

// AccountGroup returns an AccountGroupRepository bound to the Factory's handle.
func (f *Factory) AccountGroup() *AccountGroupRepository {
	return NewAccountGroupRepository(f.db)
}

// AccountGroupAssignment returns an AccountGroupAssignmentRepository bound to
// the Factory's handle.
func (f *Factory) AccountGroupAssignment() *AccountGroupAssignmentRepository {
	return NewAccountGroupAssignmentRepository(f.db)
}

// AuditLogEntry returns an AuditLogEntryRepository bound to the Factory's handle.
func (f *Factory) AuditLogEntry() *AuditLogEntryRepository {
	return NewAuditLogEntryRepository(f.db)
}

// Budget returns a BudgetRepository bound to the Factory's handle.
func (f *Factory) Budget() *BudgetRepository {
	return NewBudgetRepository(f.db)
}

// BudgetRevision returns a BudgetRevisionRepository bound to the Factory's handle.
func (f *Factory) BudgetRevision() *BudgetRevisionRepository {
	return NewBudgetRevisionRepository(f.db)
}

// BudgetRevisionAccountValue returns a BudgetRevisionAccountValueRepository
// bound to the Factory's handle.
func (f *Factory) BudgetRevisionAccountValue() *BudgetRevisionAccountValueRepository {
	return NewBudgetRevisionAccountValueRepository(f.db)
}

// BudgetAccountValue returns a BudgetAccountValueRepository bound to the
// Factory's handle.
func (f *Factory) BudgetAccountValue() *BudgetAccountValueRepository {
	return NewBudgetAccountValueRepository(f.db)
}

// BudgetActualAccountValue returns a BudgetActualAccountValueRepository bound
// to the Factory's handle.
func (f *Factory) BudgetActualAccountValue() *BudgetActualAccountValueRepository {
	return NewBudgetActualAccountValueRepository(f.db)
}

// Committee returns a CommitteeRepository bound to the Factory's handle.
func (f *Factory) Committee() *CommitteeRepository {
	return NewCommitteeRepository(f.db)
}

// CommitteeMember returns a CommitteeMemberRepository bound to the Factory's
// handle.
func (f *Factory) CommitteeMember() *CommitteeMemberRepository {
	return NewCommitteeMemberRepository(f.db)
}

// CommitteePaymentAccount returns a CommitteePaymentAccountRepository bound to
// the Factory's handle.
func (f *Factory) CommitteePaymentAccount() *CommitteePaymentAccountRepository {
	return NewCommitteePaymentAccountRepository(f.db)
}

// LedgerYear returns a LedgerYearRepository bound to the Factory's handle.
func (f *Factory) LedgerYear() *LedgerYearRepository {
	return NewLedgerYearRepository(f.db)
}

// LedgerAccount returns a LedgerAccountRepository bound to the Factory's handle.
func (f *Factory) LedgerAccount() *LedgerAccountRepository {
	return NewLedgerAccountRepository(f.db)
}

// Organization returns an OrganizationRepository bound to the Factory's handle.
func (f *Factory) Organization() *OrganizationRepository {
	return NewOrganizationRepository(f.db)
}

// OrganizationSubmissionSettings returns an
// OrganizationSubmissionSettingsRepository bound to the Factory's handle.
func (f *Factory) OrganizationSubmissionSettings() *OrganizationSubmissionSettingsRepository {
	return NewOrganizationSubmissionSettingsRepository(f.db)
}

// Report returns a ReportRepository bound to the Factory's handle.
func (f *Factory) Report() *ReportRepository {
	return NewReportRepository(f.db)
}

// ReportTemplate returns a ReportTemplateRepository bound to the Factory's handle.
func (f *Factory) ReportTemplate() *ReportTemplateRepository {
	return NewReportTemplateRepository(f.db)
}

// Submission returns a SubmissionRepository bound to the Factory's handle.
func (f *Factory) Submission() *SubmissionRepository {
	return NewSubmissionRepository(f.db)
}

// Transaction returns a TransactionRepository bound to the Factory's handle.
func (f *Factory) Transaction() *TransactionRepository {
	return NewTransactionRepository(f.db)
}

// TransactionAssignment returns a TransactionAssignmentRepository bound to
// the Factory's handle.
func (f *Factory) TransactionAssignment() *TransactionAssignmentRepository {
	return NewTransactionAssignmentRepository(f.db)
}

// User returns a UserRepository bound to the Factory's handle.
func (f *Factory) User() *UserRepository {
	return NewUserRepository(f.db)
}

// UserGroup returns a UserGroupRepository bound to the Factory's handle.
func (f *Factory) UserGroup() *UserGroupRepository {
	return NewUserGroupRepository(f.db, f.enforcer)
}

// UserIdentity returns a UserIdentityRepository bound to the Factory's handle.
func (f *Factory) UserIdentity() *UserIdentityRepository {
	return NewUserIdentityRepository(f.db)
}

// UserSettings returns a UserSettingsRepository bound to the Factory's handle.
func (f *Factory) UserSettings() *UserSettingsRepository {
	return NewUserSettingsRepository(f.db)
}
