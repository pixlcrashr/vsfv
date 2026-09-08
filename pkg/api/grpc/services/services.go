package services

import (
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
}

// New creates a Services instance wiring all concrete service implementations
// backed by repositories constructed from db.
func New(db *gorm.DB, enforcer *authz.Enforcer) *Services {
	audits := newAuditWriter(db)
	return &Services{
		Organization:               newOrganizationServiceServer(repository.NewOrganizationRepository(db), audits, enforcer),
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
		AuditLog:                   newAuditLogServiceServer(repository.NewAuditLogEntryRepository(db), repository.NewOrganizationRepository(db), enforcer),
	}
}
