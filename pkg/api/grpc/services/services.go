package services

import (
	"github.com/pixlcrashr/vsfv/pkg/auth"
	"github.com/pixlcrashr/vsfv/pkg/authz"
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
	CommitteeMember            gen.CommitteeMemberServiceServer
	CommitteePaymentAccount    gen.CommitteePaymentAccountServiceServer
	Submission                 gen.SubmissionServiceServer
	SubmissionItem             gen.SubmissionItemServiceServer
	SubmissionComment          gen.SubmissionCommentServiceServer
}

// New creates a Services instance wiring all concrete service implementations.
// The services do not hold long-lived repositories: every endpoint call opens
// a database transaction (db.Transact) and derives its repositories and audit
// writer from the transaction handle, so all of an endpoint's statements —
// including audit entries — commit or roll back together. passwordLogin backs
// the public AuthService; gitlabEnabled reports whether GitLab SSO login is
// enabled.
func New(db *gorm.DB, enforcer *authz.Enforcer, passwordLogin *auth.PasswordLoginProvider, gitlabEnabled bool) *Services {
	return &Services{
		Organization:               newOrganizationServiceServer(db, enforcer),
		Account:                    newAccountServiceServer(db, enforcer),
		AccountGroup:               newAccountGroupServiceServer(db, enforcer),
		AccountGroupAssignment:     newAccountGroupAssignmentServiceServer(db, enforcer),
		Budget:                     newBudgetServiceServer(db, enforcer),
		BudgetRevision:             newBudgetRevisionServiceServer(db, enforcer),
		BudgetRevisionAccountValue: newBudgetRevisionAccountValueServiceServer(db, enforcer),
		BudgetAccountValue:         newBudgetAccountValueServiceServer(db, enforcer),
		BudgetActualAccountValue:   newBudgetActualAccountValueServiceServer(db, enforcer),
		LedgerYear:                 newLedgerYearServiceServer(db, enforcer),
		LedgerAccount:              newLedgerAccountServiceServer(db, enforcer),
		Transaction:                newTransactionServiceServer(db, enforcer),
		TransactionAssignment:      newTransactionAssignmentServiceServer(db, enforcer),
		ReportTemplate:             newReportTemplateServiceServer(db, enforcer),
		Report:                     newReportServiceServer(db, enforcer),
		User:                       newUserServiceServer(db, enforcer),
		UserSettings:               newUserSettingsServiceServer(db, enforcer),
		UserIdentity:               newUserIdentityServiceServer(db, enforcer),
		Group:                      newGroupServiceServer(db, enforcer),
		AuditLog:                   newAuditLogServiceServer(db, enforcer),
		Auth:                       newAuthServiceServer(passwordLogin, gitlabEnabled),
		Committee:                  newCommitteeServiceServer(db, enforcer),
		CommitteeMember:            newCommitteeMemberServiceServer(db, enforcer),
		CommitteePaymentAccount:    newCommitteePaymentAccountServiceServer(db, enforcer),
		Submission:                 newSubmissionServiceServer(db, enforcer),
		SubmissionItem:             newSubmissionItemServiceServer(db, enforcer),
		SubmissionComment:          newSubmissionCommentServiceServer(db, enforcer),
	}
}
