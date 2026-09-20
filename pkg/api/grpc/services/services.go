package services

import (
	"github.com/pixlcrashr/vsfv/pkg/auth"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"gorm.io/gorm"
)

// Services holds all gRPC service server implementations.
type Services struct {
	Organization               gen.OrganizationServiceServer
	Account                    gen.AccountServiceServer
	AccountGroup               gen.AccountGroupServiceServer
	AccountGroupAssignment     gen.AccountGroupAssignmentServiceServer
	Budget                     gen.BudgetServiceServer
	BudgetRevision             gen.BudgetRevisionServiceServer
	BudgetRevisionAccountValue gen.BudgetRevisionAccountValueServiceServer
	BudgetAccountValue         gen.BudgetAccountValueServiceServer
	BudgetActualAccountValue   gen.BudgetActualAccountValueServiceServer
	LedgerYear                 gen.LedgerYearServiceServer
	LedgerAccount              gen.LedgerAccountServiceServer
	Transaction                gen.TransactionServiceServer
	TransactionAssignment      gen.TransactionAssignmentServiceServer
	ReportTemplate             gen.ReportTemplateServiceServer
	Report                     gen.ReportServiceServer
	User                       gen.UserServiceServer
	UserSettings               gen.UserSettingsServiceServer
	UserIdentity               gen.UserIdentityServiceServer
	Group                      gen.GroupServiceServer
	AuditLog                   gen.AuditLogServiceServer
	Auth                       gen.AuthServiceServer
	Committee                  gen.CommitteeServiceServer
	Submission                 gen.SubmissionServiceServer
	SubmissionItem             gen.SubmissionItemServiceServer
	SubmissionComment          gen.SubmissionCommentServiceServer
}

// New creates a Services instance wiring all concrete service implementations
// backed by repositories constructed from db. passwordLogin backs the public
// AuthService; gitlabEnabled reports whether GitLab SSO login is enabled.
func New(db *gorm.DB, enforcer *authz.Enforcer, passwordLogin *auth.PasswordLoginProvider, gitlabEnabled bool) *Services {
	audits := newAuditWriter(db)
	return &Services{
		Organization:               newOrganizationServiceServer(repository.NewOrganizationRepository(db), repository.NewOrganizationSubmissionSettingsRepository(db), audits, enforcer),
		Account:                    newAccountServiceServer(repository.NewAccountRepository(db), audits, enforcer),
		AccountGroup:               newAccountGroupServiceServer(repository.NewAccountGroupRepository(db), audits, enforcer),
		AccountGroupAssignment:     newAccountGroupAssignmentServiceServer(repository.NewAccountGroupAssignmentRepository(db), audits, enforcer),
		Budget:                     newBudgetServiceServer(repository.NewBudgetRepository(db), audits, enforcer),
		BudgetRevision:             newBudgetRevisionServiceServer(repository.NewBudgetRevisionRepository(db), repository.NewBudgetRepository(db), audits, enforcer),
		BudgetRevisionAccountValue: newBudgetRevisionAccountValueServiceServer(repository.NewBudgetRevisionAccountValueRepository(db), repository.NewAccountRepository(db), enforcer),
		BudgetAccountValue:         newBudgetAccountValueServiceServer(repository.NewBudgetAccountValueRepository(db), repository.NewAccountRepository(db), audits, enforcer),
		BudgetActualAccountValue:   newBudgetActualAccountValueServiceServer(repository.NewBudgetActualAccountValueRepository(db), repository.NewBudgetRepository(db), enforcer),
		LedgerYear:                 newLedgerYearServiceServer(repository.NewLedgerYearRepository(db), audits, enforcer),
		LedgerAccount:              newLedgerAccountServiceServer(repository.NewLedgerAccountRepository(db), audits, enforcer),
		Transaction:                newTransactionServiceServer(repository.NewTransactionRepository(db), repository.NewLedgerAccountRepository(db), audits, enforcer),
		TransactionAssignment:      newTransactionAssignmentServiceServer(repository.NewTransactionAssignmentRepository(db), repository.NewAccountRepository(db), repository.NewOrganizationRepository(db), repository.NewTransactionRepository(db), audits, enforcer),
		ReportTemplate:             newReportTemplateServiceServer(repository.NewReportTemplateRepository(db), audits, enforcer),
		Report:                     newReportServiceServer(repository.NewReportRepository(db), audits, enforcer),
		User:                       newUserServiceServer(repository.NewUserRepository(db), repository.NewUserGroupRepository(db, enforcer), enforcer),
		UserSettings:               newUserSettingsServiceServer(repository.NewUserSettingsRepository(db), audits, enforcer),
		UserIdentity:               newUserIdentityServiceServer(repository.NewUserIdentityRepository(db), enforcer),
		Group:                      newGroupServiceServer(repository.NewUserGroupRepository(db, enforcer), audits, enforcer),
		AuditLog:                   newAuditLogServiceServer(repository.NewAuditLogEntryRepository(db), repository.NewOrganizationRepository(db), repository.NewUserRepository(db), enforcer),
		Auth:                       newAuthServiceServer(passwordLogin, gitlabEnabled),
		Committee:                  newCommitteeServiceServer(repository.NewCommitteeRepository(db), repository.NewSubmissionRepository(db), audits, enforcer),
		Submission:                 newSubmissionServiceServer(repository.NewSubmissionRepository(db), repository.NewCommitteeRepository(db), repository.NewOrganizationSubmissionSettingsRepository(db), audits, enforcer),
		SubmissionItem:             newSubmissionItemServiceServer(repository.NewSubmissionRepository(db), audits, enforcer),
		SubmissionComment:          newSubmissionCommentServiceServer(repository.NewSubmissionRepository(db), enforcer),
	}
}
