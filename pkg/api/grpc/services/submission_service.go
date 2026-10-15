package services

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/amalfra/etag/v4"
	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"go.einride.tech/aip/ordering"
	date "google.golang.org/genproto/googleapis/type/date"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

var (
	statusSubmissionRequired               = status.New(codes.InvalidArgument, "submission is required")
	statusInvalidSubmissionName            = status.New(codes.InvalidArgument, "invalid submission name")
	statusSubmissionNotFound               = status.New(codes.NotFound, "submission not found")
	statusSubmissionAlreadyExists          = status.New(codes.AlreadyExists, "submission already exists")
	statusSubmissionTypeRequired           = status.New(codes.InvalidArgument, "submission type is required")
	statusSubmissionDirectionRequired      = status.New(codes.InvalidArgument, "direction is required")
	statusSubmissionSettlementRequired     = status.New(codes.InvalidArgument, "settlement is required for expense submissions")
	statusSubmissionSettlementNotAllowed   = status.New(codes.InvalidArgument, "settlement details do not match the settlement kind")
	statusSubmissionSettlementDisabled     = status.New(codes.FailedPrecondition, "settlement kind is not enabled for this organization")
	statusSubmissionPersonDetailsRequired  = status.New(codes.InvalidArgument, "payout details are required for person settlements")
	statusSubmissionPaymentAccountInvalid  = status.New(codes.InvalidArgument, "payment account does not belong to the committee")
	statusSubmissionPaymentAccountRequired = status.New(codes.InvalidArgument, "payment account is required for committee account settlements")
	statusInvalidPaymentAccountName        = status.New(codes.InvalidArgument, "invalid payment account name")
	statusSubmissionPaidDateRequired       = status.New(codes.InvalidArgument, "paid date is required for committee account settlements")
	statusSubmissionVendorDetailsRequired  = status.New(codes.InvalidArgument, "vendor details are required for payment requests")
	statusSubmissionItemsRequired          = status.New(codes.FailedPrecondition, "submission requires at least one item")
	statusReasonRequired                   = status.New(codes.InvalidArgument, "reason is required")
	statusSubmissionScopeLocked            = status.New(codes.PermissionDenied, "changing the scope requires the treasury update permission")
	statusSubmissionNotEditable            = status.New(codes.FailedPrecondition, "submission is not editable in its current state")
	statusSubmissionInvalidTransition      = status.New(codes.FailedPrecondition, "submission status transition is not allowed")
	statusSubmissionDeadlinePassed         = status.New(codes.FailedPrecondition, "submission deadline has passed")
	statusSubmissionDeleted                = status.New(codes.FailedPrecondition, "submission is deleted")
	statusEtagMismatch                     = status.New(codes.Aborted, "etag mismatch")
	statusInvalidUpdateMask                = status.New(codes.InvalidArgument, "invalid update mask")
	statusFailedGetSubmission              = status.New(codes.Internal, "failed to get submission")
	statusFailedListSubmissions            = status.New(codes.Internal, "failed to list submissions")
	statusFailedCreateSubmission           = status.New(codes.Internal, "failed to create submission")
	statusFailedUpdateSubmission           = status.New(codes.Internal, "failed to update submission")
	statusFailedDeleteSubmission           = status.New(codes.Internal, "failed to delete submission")
	statusFailedSubmitSubmission           = status.New(codes.Internal, "failed to submit submission")
	statusFailedApproveSubmission          = status.New(codes.Internal, "failed to approve submission")
	statusFailedRejectSubmission           = status.New(codes.Internal, "failed to reject submission")
	statusFailedRequestFurtherInfo         = status.New(codes.Internal, "failed to request further information")
	statusFailedCompleteSubmission         = status.New(codes.Internal, "failed to complete submission")
	statusFailedUndeleteSubmission         = status.New(codes.Internal, "failed to restore submission")
)

// submissionPurgeRetention is how long a soft-deleted submission remains
// recoverable before it is treated as purged (AIP-164).
const submissionPurgeRetention = 90 * 24 * time.Hour

// submissionServiceServer implements gen.SubmissionServiceServer.
type submissionServiceServer struct {
	db       *gorm.DB
	enforcer *authz.Enforcer
}

func newSubmissionServiceServer(db *gorm.DB, enforcer *authz.Enforcer) gen.SubmissionServiceServer {
	return &submissionServiceServer{db: db, enforcer: enforcer}
}

// ── access helpers ───────────────────────────────────────────────────────────

// checkSubmissionRead permits the read action, falling back to read_own for
// the submitter's own submission.
func checkSubmissionRead(ctx context.Context, enforcer *authz.Enforcer, orgSegment string, m *model.Submission) error {
	domain := authz.OrgDomain(orgSegment)
	if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionRead, domain); err == nil {
		return nil
	}
	if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionReadOwn, domain); err != nil {
		return err
	}
	return requireOwner(ctx, m)
}

// checkSubmissionWrite permits the update action, falling back to update_own
// for the submitter's own submission.
func checkSubmissionWrite(ctx context.Context, enforcer *authz.Enforcer, orgSegment string, m *model.Submission) error {
	domain := authz.OrgDomain(orgSegment)
	if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionUpdate, domain); err == nil {
		return nil
	}
	if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionUpdateOwn, domain); err != nil {
		return err
	}
	return requireOwner(ctx, m)
}

// checkSubmissionDelete permits the delete action, falling back to update_own
// for the submitter's own submission.
func checkSubmissionDelete(ctx context.Context, enforcer *authz.Enforcer, orgSegment string, m *model.Submission) error {
	domain := authz.OrgDomain(orgSegment)
	if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionDelete, domain); err == nil {
		return nil
	}
	if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionUpdateOwn, domain); err != nil {
		return err
	}
	return requireOwner(ctx, m)
}

// checkSubmissionComment permits the comment action, falling back to
// comment_own for the submitter's own submission.
func checkSubmissionComment(ctx context.Context, enforcer *authz.Enforcer, orgSegment string, m *model.Submission) error {
	domain := authz.OrgDomain(orgSegment)
	if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionComment, domain); err == nil {
		return nil
	}
	if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionCommentOwn, domain); err != nil {
		return err
	}
	return requireOwner(ctx, m)
}

// hasFullAction reports whether the caller holds the full (non-own) action.
func hasFullAction(ctx context.Context, enforcer *authz.Enforcer, orgSegment, action string) bool {
	return authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, action, authz.OrgDomain(orgSegment)) == nil
}

func requireOwner(ctx context.Context, m *model.Submission) error {
	user, ok := authz.UserIDFromContext(ctx)
	if !ok || user == "" || user != m.CreatedByUserID.String() {
		return &ServerError{Status: statusPermissionDenied}
	}
	return nil
}

// parseSubmissionDirectionFilter resolves a direction filter value, accepting
// both the short form ("INCOME") and the fully qualified proto enum name
// ("DIRECTION_INCOME"). Misc is a type, not a direction, and is rejected here.
func parseSubmissionDirectionFilter(v string) (model.SubmissionDirection, error) {
	switch strings.ToUpper(strings.TrimSpace(v)) {
	case "INCOME", "DIRECTION_INCOME":
		return model.SubmissionDirectionIncome, nil
	case "EXPENSE", "DIRECTION_EXPENSE":
		return model.SubmissionDirectionExpense, nil
	default:
		return model.SubmissionDirection(-1), fmt.Errorf("invalid direction filter value %q", v)
	}
}

// parseSubmissionTypeFilter resolves a type filter value; it exists for the
// "MISC" direction filter alias, which selects misc-type submissions.
func parseSubmissionTypeFilter(v string) (model.SubmissionType, error) {
	switch strings.ToUpper(strings.TrimSpace(v)) {
	case "MISC", "TYPE_MISC":
		return model.SubmissionTypeMisc, nil
	default:
		return model.SubmissionType(-1), fmt.Errorf("invalid type filter value %q", v)
	}
}

// parseSubmissionSettlementFilter resolves a settlement filter value.
func parseSubmissionSettlementFilter(v string) (model.SubmissionSettlementType, error) {
	switch strings.ToUpper(strings.TrimSpace(v)) {
	case "PERSON", "SETTLEMENT_PERSON":
		return model.SubmissionSettlementTypePerson, nil
	case "COMMITTEE_ACCOUNT", "SETTLEMENT_COMMITTEE_ACCOUNT":
		return model.SubmissionSettlementTypeCommitteeAccount, nil
	case "PAYMENT_REQUEST", "SETTLEMENT_PAYMENT_REQUEST":
		return model.SubmissionSettlementTypePaymentRequest, nil
	default:
		return model.SubmissionSettlementType(-1), fmt.Errorf("invalid settlement filter value %q", v)
	}
}

// parseSubmissionStatusFilter resolves a status filter value.
func parseSubmissionStatusFilter(v string) (model.SubmissionStatus, error) {
	switch strings.ToUpper(strings.TrimSpace(v)) {
	case "DRAFT", "SUBMISSION_STATUS_DRAFT":
		return model.SubmissionStatusDraft, nil
	case "PENDING", "SUBMISSION_STATUS_PENDING":
		return model.SubmissionStatusPending, nil
	case "FURTHER_INFO_REQUIRED", "SUBMISSION_STATUS_FURTHER_INFO_REQUIRED":
		return model.SubmissionStatusFurtherInfoRequired, nil
	case "REJECTED", "SUBMISSION_STATUS_REJECTED":
		return model.SubmissionStatusRejected, nil
	case "APPROVED", "SUBMISSION_STATUS_APPROVED":
		return model.SubmissionStatusApproved, nil
	case "COMPLETED", "SUBMISSION_STATUS_COMPLETED":
		return model.SubmissionStatusCompleted, nil
	default:
		return model.SubmissionStatus(-1), fmt.Errorf("invalid status filter value %q", v)
	}
}

// ── deadline & validation helpers ────────────────────────────────────────────

// checkSubmissionDeadline enforces the organization-wide submission deadline.
// Callers holding the full update permission bypass it (grace handling).
func (s *submissionServiceServer) checkSubmissionDeadline(ctx context.Context, settingsRepo *repository.OrganizationSubmissionSettingsRepository, orgID uuid.UUID, orgSegment string) error {
	settings, err := settingsRepo.GetOrDefault(ctx, orgID)
	if err != nil {
		return &ServerError{Err: err, Status: statusFailedGetSubmission}
	}
	if settings.SubmissionDeadline == nil {
		return nil
	}
	d := *settings.SubmissionDeadline
	deadline := time.Date(d.Year(), d.Month(), d.Day(), 23, 59, 59, 0, time.UTC)
	if time.Now().UTC().Before(deadline) {
		return nil
	}
	if hasFullAction(ctx, s.enforcer, orgSegment, authz.ActionUpdate) {
		return nil
	}
	return &ServerError{Status: statusSubmissionDeadlinePassed}
}

// checkSettlementEnabled verifies the settlement kind is enabled org-wide.
func (s *submissionServiceServer) checkSettlementEnabled(ctx context.Context, settingsRepo *repository.OrganizationSubmissionSettingsRepository, orgID uuid.UUID, settlement model.NullSubmissionSettlementType) error {
	// An unset settlement (drafts, income) is not organization-restricted.
	if !settlement.Valid {
		return nil
	}
	settings, err := settingsRepo.GetOrDefault(ctx, orgID)
	if err != nil {
		return &ServerError{Err: err, Status: statusFailedGetSubmission}
	}
	if len(settings.EnabledSettlementKinds) == 0 {
		return nil
	}
	name := submissionSettlementTypeName(settlement.SubmissionSettlementType)
	for _, k := range settings.EnabledSettlementKinds {
		if k == name {
			return nil
		}
	}
	return &ServerError{Status: statusSubmissionSettlementDisabled}
}

// submissionSettlementTypeName maps a settlement enum to its proto enum value name (the
// representation stored in organization submission settings).
func submissionSettlementTypeName(s model.SubmissionSettlementType) string {
	switch s {
	case model.SubmissionSettlementTypePerson:
		return "PERSON"
	case model.SubmissionSettlementTypeCommitteeAccount:
		return "COMMITTEE_ACCOUNT"
	case model.SubmissionSettlementTypePaymentRequest:
		return "PAYMENT_REQUEST"
	default:
		return ""
	}
}

// parseCommitteeID extracts the committee UUID from a committee resource name.
func parseCommitteeID(name string) (uuid.UUID, error) {
	var cn gen.CommitteeResourceName
	if err := cn.UnmarshalString(name); err != nil {
		return uuid.Nil, err
	}
	return uuid.Parse(cn.Committee)
}

// parseCommitteePaymentAccountID extracts the payment account UUID from a committee
// payment account resource name.
func parseCommitteePaymentAccountID(name string) (uuid.UUID, error) {
	var an gen.CommitteePaymentAccountResourceName
	if err := an.UnmarshalString(name); err != nil {
		return uuid.Nil, err
	}
	return uuid.Parse(an.PaymentAccount)
}

// The database stores 0-based enum values without filler values, while the
// proto enums reserve 0 as the unspecified filler. Explicit converters keep
// the two numberings independent.

func submissionScopeFromProto(v gen.SubmissionScope) model.SubmissionScope {
	switch v {
	case gen.SubmissionScope_SUBMISSION_SCOPE_COMMERCIAL:
		return model.SubmissionScopeCommercial
	case gen.SubmissionScope_SUBMISSION_SCOPE_NONPROFIT:
		return model.SubmissionScopeNonprofit
	default:
		return model.SubmissionScopeNone
	}
}

func submissionScopeToProto(s model.SubmissionScope) gen.SubmissionScope {
	switch s {
	case model.SubmissionScopeNonprofit:
		return gen.SubmissionScope_SUBMISSION_SCOPE_NONPROFIT
	case model.SubmissionScopeCommercial:
		return gen.SubmissionScope_SUBMISSION_SCOPE_COMMERCIAL
	case model.SubmissionScopeNone:
		return gen.SubmissionScope_SUBMISSION_SCOPE_NONE
	default:
		return gen.SubmissionScope_SUBMISSION_SCOPE_UNSPECIFIED
	}
}

func submissionStatusToProto(s model.SubmissionStatus) gen.SubmissionStatus {
	switch s {
	case model.SubmissionStatusDraft:
		return gen.SubmissionStatus_SUBMISSION_STATUS_DRAFT
	case model.SubmissionStatusPending:
		return gen.SubmissionStatus_SUBMISSION_STATUS_PENDING
	case model.SubmissionStatusFurtherInfoRequired:
		return gen.SubmissionStatus_SUBMISSION_STATUS_FURTHER_INFO_REQUIRED
	case model.SubmissionStatusRejected:
		return gen.SubmissionStatus_SUBMISSION_STATUS_REJECTED
	case model.SubmissionStatusApproved:
		return gen.SubmissionStatus_SUBMISSION_STATUS_APPROVED
	case model.SubmissionStatusCompleted:
		return gen.SubmissionStatus_SUBMISSION_STATUS_COMPLETED
	default:
		return gen.SubmissionStatus_SUBMISSION_STATUS_UNSPECIFIED
	}
}

// strPtr converts a proto string to a nullable column value: an empty string
// means absent and stores NULL.
func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// ptrEq reports whether two comparable pointers are both nil or point at
// equal values.
func ptrEq[T comparable](a, b *T) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// clearSubmissionSettlementDetails zeroes every settlement detail column.
func clearSubmissionSettlementDetails(m *model.Submission) {
	m.SettlementType = model.NullSubmissionSettlementType{}
	m.PersonPayoutMethod = model.NullSubmissionPersonPayoutMethod{}
	m.PersonBankAccountHolder = nil
	m.PersonBankIban = nil
	m.PersonBankBic = nil
	m.PersonBankAccountNumber = nil
	m.CommitteePaymentAccountID = uuid.NullUUID{}
	m.CommitteePaymentAccountLabel = nil
	m.CommitteeAccountPaidDate = nil
	m.CommitteeAccountPaymentReference = nil
	m.PaymentRequestBankAccountHolder = nil
	m.PaymentRequestBankIban = nil
	m.PaymentRequestBankBic = nil
	m.PaymentRequestBankAccountNumber = nil
}

// applySubmissionMiscType writes the misc submission type onto m.
func applySubmissionMiscType(m *model.Submission) {
	clearSubmissionSettlementDetails(m)
	m.Type = model.SubmissionTypeMisc
	m.Direction = model.NullSubmissionDirection{}
}

// applySubmissionIncomeSettlement writes the income direction onto m, keeping the scope.
func applySubmissionIncomeSettlement(m *model.Submission) {
	clearSubmissionSettlementDetails(m)
	m.Type = model.SubmissionTypeIncomeExpense
	m.Direction = model.NullSubmissionDirection{
		SubmissionDirection: model.SubmissionDirectionIncome,
		Valid:               true,
	}
}

// applySubmissionExpenseSettlement writes the settlement oneof of an expense direction
// onto m. Unset branch details (e.g. a not-yet-chosen payout method) are
// stored as NULL so drafts may stay incomplete.
func applySubmissionExpenseSettlement(m *model.Submission, e *gen.SubmissionDirectionExpenseDetails) error {
	clearSubmissionSettlementDetails(m)
	m.Type = model.SubmissionTypeIncomeExpense
	m.Direction = model.NullSubmissionDirection{
		SubmissionDirection: model.SubmissionDirectionExpense,
		Valid:               true,
	}

	switch s := e.GetSettlement().(type) {
	case *gen.SubmissionDirectionExpenseDetails_Person:
		m.SettlementType = model.NullSubmissionSettlementType{
			SubmissionSettlementType: model.SubmissionSettlementTypePerson,
			Valid:                    true,
		}
		switch pm := s.Person.GetPayoutMethod().(type) {
		case *gen.SubmissionSettlementPerson_BankTransfer:
			m.PersonPayoutMethod = model.NullSubmissionPersonPayoutMethod{
				SubmissionPersonPayoutMethod: model.SubmissionPersonPayoutMethodBankTransfer,
				Valid:                        true,
			}
			ba := pm.BankTransfer.GetBankAccount()
			m.PersonBankAccountHolder = strPtr(ba.GetAccountHolder())
			m.PersonBankIban = strPtr(ba.GetIban())
			m.PersonBankBic = strPtr(ba.GetBic())
			m.PersonBankAccountNumber = strPtr(ba.GetAccountNumber())
		case *gen.SubmissionSettlementPerson_Cash:
			m.PersonPayoutMethod = model.NullSubmissionPersonPayoutMethod{
				SubmissionPersonPayoutMethod: model.SubmissionPersonPayoutMethodCash,
				Valid:                        true,
			}
		default:
			m.PersonPayoutMethod = model.NullSubmissionPersonPayoutMethod{}
		}
	case *gen.SubmissionDirectionExpenseDetails_CommitteeAccount:
		m.SettlementType = model.NullSubmissionSettlementType{
			SubmissionSettlementType: model.SubmissionSettlementTypeCommitteeAccount,
			Valid:                    true,
		}
		ca := s.CommitteeAccount
		if ca.GetPaymentAccount() != "" {
			uid, err := parseCommitteePaymentAccountID(ca.GetPaymentAccount())
			if err != nil {
				return &ServerError{Err: err, Status: statusInvalidPaymentAccountName}
			}
			m.CommitteePaymentAccountID = uuid.NullUUID{Valid: true, UUID: uid}
		}
		m.CommitteeAccountPaidDate = protoToDate(ca.GetPaidDate())
		m.CommitteeAccountPaymentReference = strPtr(ca.GetPaymentReference())
	case *gen.SubmissionDirectionExpenseDetails_PaymentRequest:
		m.SettlementType = model.NullSubmissionSettlementType{
			SubmissionSettlementType: model.SubmissionSettlementTypePaymentRequest,
			Valid:                    true,
		}
		ba := s.PaymentRequest.GetBankAccount()
		m.PaymentRequestBankAccountHolder = strPtr(ba.GetAccountHolder())
		m.PaymentRequestBankIban = strPtr(ba.GetIban())
		m.PaymentRequestBankBic = strPtr(ba.GetBic())
		m.PaymentRequestBankAccountNumber = strPtr(ba.GetAccountNumber())
	default:
		// The settlement is not picked yet (drafts).
		m.SettlementType = model.NullSubmissionSettlementType{}
	}
	return nil
}

// applySubmissionIncomeExpenseType writes the income/expense submission type onto m.
func applySubmissionIncomeExpenseType(m *model.Submission, t *gen.SubmissionTypeIncomeExpenseDetails) error {
	m.Scope = submissionScopeFromProto(t.GetScope())

	switch t.GetDirection().(type) {
	case *gen.SubmissionTypeIncomeExpenseDetails_Income:
		applySubmissionIncomeSettlement(m)
		return nil
	case *gen.SubmissionTypeIncomeExpenseDetails_Expense:
		return applySubmissionExpenseSettlement(m, t.GetExpense())
	default:
		return &ServerError{Status: statusSubmissionDirectionRequired}
	}
}

// applySubmissionType writes the full type oneof of p onto m.
func applySubmissionType(m *model.Submission, p *gen.Submission) error {
	switch t := p.GetType().(type) {
	case *gen.Submission_Misc:
		applySubmissionMiscType(m)
		return nil
	case *gen.Submission_IncomeExpense:
		return applySubmissionIncomeExpenseType(m, t.IncomeExpense)
	default:
		return &ServerError{Status: statusSubmissionTypeRequired}
	}
}

// normalizeSubmissionDetails validates and normalizes the type, direction and
// settlement details of m against the committee's payment accounts. For
// committee account settlements the account label snapshot is resolved here.
func normalizeSubmissionDetails(ctx context.Context, committeeRepo *repository.CommitteeRepository, m *model.Submission) error {
	switch m.Type {
	case model.SubmissionTypeMisc:
		// Misc document collections carry neither a direction nor a scope
		// nor a settlement.
		m.Direction = model.NullSubmissionDirection{}
		m.SettlementType = model.NullSubmissionSettlementType{}
		return nil
	case model.SubmissionTypeIncomeExpense:
		// handled below
	default:
		return &ServerError{Status: statusSubmissionTypeRequired}
	}

	if !m.Direction.Valid {
		return &ServerError{Status: statusSubmissionDirectionRequired}
	}
	switch m.Direction.SubmissionDirection {
	case model.SubmissionDirectionIncome:
		// Income submissions are pure documentation; no settlement applies.
		m.SettlementType = model.NullSubmissionSettlementType{}
		return nil
	case model.SubmissionDirectionExpense:
		// handled below
	default:
		return &ServerError{Status: statusSubmissionDirectionRequired}
	}

	// Only a concrete settlement satisfies an expense submission; an unset
	// settlement means the submitter has not picked one yet.
	if !m.SettlementType.Valid {
		return &ServerError{Status: statusSubmissionSettlementRequired}
	}

	switch m.SettlementType.SubmissionSettlementType {
	case model.SubmissionSettlementTypePerson:
		if !m.PersonPayoutMethod.Valid {
			return &ServerError{Status: statusSubmissionPersonDetailsRequired}
		}
		if m.PersonPayoutMethod.SubmissionPersonPayoutMethod == model.SubmissionPersonPayoutMethodBankTransfer && (m.PersonBankAccountHolder == nil || m.PersonBankIban == nil) {
			return &ServerError{Status: statusSubmissionPersonDetailsRequired}
		}
	case model.SubmissionSettlementTypeCommitteeAccount:
		if !m.CommitteePaymentAccountID.Valid {
			return &ServerError{Status: statusSubmissionPaymentAccountRequired}
		}
		if m.CommitteeAccountPaidDate == nil {
			return &ServerError{Status: statusSubmissionPaidDateRequired}
		}
		committee, err := committeeRepo.GetByID(ctx, m.CommitteeID)
		if err != nil {
			return &ServerError{Err: err, Status: statusSubmissionPaymentAccountInvalid}
		}
		for _, pa := range committee.PaymentAccounts {
			if pa.ID == m.CommitteePaymentAccountID.UUID {
				m.CommitteePaymentAccountLabel = &pa.DisplayLabel
				return nil
			}
		}
		return &ServerError{Status: statusSubmissionPaymentAccountInvalid}
	case model.SubmissionSettlementTypePaymentRequest:
		if m.PaymentRequestBankAccountHolder == nil || m.PaymentRequestBankIban == nil {
			return &ServerError{Status: statusSubmissionVendorDetailsRequired}
		}
	default:
		return &ServerError{Status: statusSubmissionSettlementRequired}
	}
	return nil
}

// loadSubmission resolves a submission resource name into the model,
// verifying it exists (and is not purged).
func (s *submissionServiceServer) loadSubmission(ctx context.Context, repo *repository.SubmissionRepository, n gen.SubmissionResourceName) (*model.Submission, uuid.UUID, error) {
	id, err := uuid.Parse(n.Submission)
	if err != nil {
		return nil, uuid.Nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}
	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, uuid.Nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}
	m, err := repo.GetByID(ctx, id)
	if err != nil {
		return nil, uuid.Nil, err
	}
	return m, orgID, nil
}

// ── proto mapping ────────────────────────────────────────────────────────────

// bankAccountToProto maps stored bank details to the proto BankAccount, or
// nil when every field is absent.
func bankAccountToProto(holder, iban, bic, accountNumber *string) *gen.BankAccount {
	if holder == nil && iban == nil && bic == nil && accountNumber == nil {
		return nil
	}
	return &gen.BankAccount{
		AccountHolder: derefStr(holder),
		Iban:          derefStr(iban),
		Bic:           derefStr(bic),
		AccountNumber: derefStr(accountNumber),
	}
}

// derefStr returns the pointed-at string or "" for nil.
func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func submissionToProto(n gen.SubmissionResourceName, m *model.Submission) *gen.Submission {
	p := &gen.Submission{
		Name:          n.String(),
		Uid:           m.ID.String(),
		PublicId:      m.PublicID,
		CreatedByUser: "users/" + m.CreatedByUserID.String(),
		Committee:     (&gen.CommitteeResourceName{Organization: n.Organization, Committee: m.CommitteeID.String()}).String(),
		Status:        submissionStatusToProto(m.Status),
		Notice:        m.Notice,
		TotalAmount:   &gen.Decimal{Value: m.TotalAmount.String()},
		CreateTime:    timestamppb.New(m.CreatedAt),
		UpdateTime:    timestamppb.New(m.UpdatedAt),
	}
	if m.DeletedAt.Valid {
		p.DeleteTime = timestamppb.New(m.DeletedAt.Time)
	}
	if m.PurgeTime != nil {
		p.PurgeTime = timestamppb.New(*m.PurgeTime)
	}

	if m.Type == model.SubmissionTypeMisc {
		p.Type = &gen.Submission_Misc{Misc: &gen.SubmissionTypeMiscDetails{}}
		p.Etag = etag.Generate(p.String(), false)
		return p
	}

	t := &gen.SubmissionTypeIncomeExpenseDetails{
		Scope: submissionScopeToProto(m.Scope),
	}
	if m.Direction.Valid && m.Direction.SubmissionDirection == model.SubmissionDirectionExpense {
		expense := &gen.SubmissionDirectionExpenseDetails{}
		t.Direction = &gen.SubmissionTypeIncomeExpenseDetails_Expense{Expense: expense}

		// An unset settlement must not fall through to the Person case (the
		// enum's zero value), so unset maps to an out-of-range sentinel and
		// lands in the default branch below.
		settlement := model.SubmissionSettlementType(-1)
		if m.SettlementType.Valid {
			settlement = m.SettlementType.SubmissionSettlementType
		}
		switch settlement {
		case model.SubmissionSettlementTypePerson:
			person := &gen.SubmissionSettlementPerson{}
			if m.PersonPayoutMethod.Valid {
				if m.PersonPayoutMethod.SubmissionPersonPayoutMethod == model.SubmissionPersonPayoutMethodCash {
					person.PayoutMethod = &gen.SubmissionSettlementPerson_Cash{Cash: &gen.SubmissionPayoutMethodCash{}}
				} else {
					person.PayoutMethod = &gen.SubmissionSettlementPerson_BankTransfer{
						BankTransfer: &gen.SubmissionPayoutMethodBankTransfer{
							BankAccount: bankAccountToProto(
								m.PersonBankAccountHolder, m.PersonBankIban, m.PersonBankBic, m.PersonBankAccountNumber,
							),
						},
					}
				}
			}
			expense.Settlement = &gen.SubmissionDirectionExpenseDetails_Person{Person: person}
		case model.SubmissionSettlementTypeCommitteeAccount:
			ca := &gen.SubmissionSettlementCommitteeAccount{
				PaymentReference: derefStr(m.CommitteeAccountPaymentReference),
			}
			if m.CommitteePaymentAccountID.Valid {
				ca.PaymentAccount = (&gen.CommitteePaymentAccountResourceName{
					Organization:   n.Organization,
					Committee:      m.CommitteeID.String(),
					PaymentAccount: m.CommitteePaymentAccountID.UUID.String(),
				}).String()
			}
			if m.CommitteeAccountPaidDate != nil {
				ca.PaidDate = dateToProto(m.CommitteeAccountPaidDate)
			}
			expense.Settlement = &gen.SubmissionDirectionExpenseDetails_CommitteeAccount{CommitteeAccount: ca}
		case model.SubmissionSettlementTypePaymentRequest:
			expense.Settlement = &gen.SubmissionDirectionExpenseDetails_PaymentRequest{
				PaymentRequest: &gen.SubmissionSettlementPaymentRequest{
					BankAccount: bankAccountToProto(
						m.PaymentRequestBankAccountHolder, m.PaymentRequestBankIban, m.PaymentRequestBankBic, m.PaymentRequestBankAccountNumber,
					),
				},
			}
		default:
			// The settlement is not picked yet (drafts).
		}
	} else {
		t.Direction = &gen.SubmissionTypeIncomeExpenseDetails_Income{Income: &gen.SubmissionDirectionIncomeDetails{}}
	}
	p.Type = &gen.Submission_IncomeExpense{IncomeExpense: t}
	p.Etag = etag.Generate(p.String(), false)
	return p
}

// dateToProto converts a time to a google.type.Date (civil date).
func dateToProto(t *time.Time) *date.Date {
	if t == nil {
		return nil
	}
	return &date.Date{Year: int32(t.Year()), Month: int32(t.Month()), Day: int32(t.Day())}
}

// protoToDate converts a google.type.Date to a UTC time (midnight).
func protoToDate(d *date.Date) *time.Time {
	if d == nil || d.Year == 0 {
		return nil
	}
	t := time.Date(int(d.Year), time.Month(d.Month), int(d.Day), 0, 0, 0, 0, time.UTC)
	return &t
}

// ── SubmissionService ────────────────────────────────────────────────────────

func (s *submissionServiceServer) GetSubmission(ctx context.Context, req *gen.GetSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Submission, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Submission()

		m, _, err := s.loadSubmission(ctx, repo, n)
		if err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if err := checkSubmissionRead(ctx, s.enforcer, n.Organization, m); err != nil {
			return nil, err
		}

		return submissionToProto(n, m), nil
	})
}

func (s *submissionServiceServer) ListSubmissions(ctx context.Context, req *gen.ListSubmissionsRequest) (*gen.ListSubmissionsResponse, error) {
	var pn gen.OrganizationResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	// read_own-only callers are restricted to their own submissions.
	fullRead := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionRead, authz.OrgDomain(pn.Organization)) == nil
	if !fullRead {
		if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionReadOwn, authz.OrgDomain(pn.Organization)); err != nil {
			return nil, authError(err)
		}
	}

	c, err := svcfilter.ParseSubmissionFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	filters, remaining, err := svcfilter.ExtractSubmissionFilters(c)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	offset, err := pagetoken.Decode(req.PageToken)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidPageToken}
	}

	pageSize := normalizePageSize(req.PageSize)
	orderBy, err := ordering.ParseOrderBy(req)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrderBy}
	}
	orderExprs, _ := order.Resolve(orderBy, repository.SubmissionOrderFieldMapper)

	params := repository.ListSubmissionsParams{
		Cond:        remaining,
		Page:        int(offset/int64(pageSize)) + 1,
		PageSize:    pageSize,
		ShowDeleted: req.ShowDeleted,
		OrderBy:     orderExprs,
	}

	if filters.Direction != nil {
		// direction="MISC" selects misc-type submissions, which carry no
		// direction of their own.
		if t, err := parseSubmissionTypeFilter(*filters.Direction); err == nil {
			params.Type = &t
		} else {
			d, err := parseSubmissionDirectionFilter(*filters.Direction)
			if err != nil {
				return nil, &ServerError{Err: err, Status: statusInvalidFilter}
			}
			params.Direction = &d
		}
	}
	if filters.Settlement != nil {
		st, err := parseSubmissionSettlementFilter(*filters.Settlement)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidFilter}
		}
		params.SettlementType = &st
	}
	if filters.Status != nil {
		st, err := parseSubmissionStatusFilter(*filters.Status)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidFilter}
		}
		params.Status = &st
	}
	// Drafts are only listed when explicitly filtered by status.
	params.ExcludeDrafts = filters.Status == nil

	if filters.Committee != "" {
		var cn gen.CommitteeResourceName
		if err := cn.UnmarshalString(filters.Committee); err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidFilter}
		}
		cid, err := uuid.Parse(cn.Committee)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidFilter}
		}
		params.CommitteeID = &cid
	}
	if filters.CreatedByUser != "" {
		uid, err := uuid.Parse(strings.TrimPrefix(filters.CreatedByUser, "users/"))
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidFilter}
		}
		params.CreatedByUserID = &uid
	}
	if !fullRead {
		user, _ := authz.UserIDFromContext(ctx)
		uid, err := uuid.Parse(user)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusUnauthenticated}
		}
		params.CreatedByUserID = &uid
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.ListSubmissionsResponse, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Submission()

		ms, total, err := repo.List(ctx, params)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListSubmissions}
		}

		resp := &gen.ListSubmissionsResponse{TotalSize: total}
		for _, m := range ms {
			resp.Submissions = append(resp.Submissions, submissionToProto(
				gen.SubmissionResourceName{Organization: pn.Organization, Submission: m.ID.String()}, m,
			))
		}

		nextOffset := offset + int64(len(ms))
		if nextOffset < total {
			resp.NextPageToken = pagetoken.Encode(nextOffset)
		}

		return resp, nil
	})
}

func (s *submissionServiceServer) CreateSubmission(ctx context.Context, req *gen.CreateSubmissionRequest) (*gen.Submission, error) {
	if req.Submission == nil {
		return nil, &ServerError{Status: statusSubmissionRequired}
	}

	var pn gen.OrganizationResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionCreate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	committeeID, err := parseCommitteeID(req.Submission.GetCommittee())
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeName}
	}

	if req.Submission.GetType() == nil {
		return nil, &ServerError{Status: statusSubmissionTypeRequired}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Submission, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Submission()
		committeeRepo := f.Committee()
		settingsRepo := f.OrganizationSubmissionSettings()
		audits := newAuditWriter(tx)

		committee, err := committeeRepo.GetByID(ctx, committeeID)
		if err != nil {
			if errors.Is(err, repository.ErrCommitteeNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteeNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedCreateSubmission}
		}

		user, _ := authz.UserIDFromContext(ctx)
		createdBy, err := uuid.Parse(user)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusUnauthenticated}
		}

		// Drafts may be incomplete: the type structure (direction, settlement,
		// settlement details) is stored as provided and validated on submit.
		var t model.Submission
		if err := applySubmissionType(&t, req.Submission); err != nil {
			return nil, err
		}
		if t.Type == model.SubmissionTypeIncomeExpense && !committee.AllowScopeSelection {
			t.Scope = submissionScopeFromProto(gen.SubmissionScope_SUBMISSION_SCOPE_NONPROFIT)
		}

		if err := s.checkSettlementEnabled(ctx, settingsRepo, orgID, t.SettlementType); err != nil {
			return nil, err
		}

		m, err := repo.Create(ctx, repository.CreateSubmissionParams{
			OrganizationID:  orgID,
			CreatedByUserID: createdBy,
			CommitteeID:     committeeID,
			Type:            t.Type,
			Direction:       t.Direction,
			SettlementType:  t.SettlementType,
			Scope:           t.Scope,
			Notice:          req.Submission.GetNotice(),

			PersonPayoutMethod:               t.PersonPayoutMethod,
			PersonBankAccountHolder:          t.PersonBankAccountHolder,
			PersonBankIban:                   t.PersonBankIban,
			PersonBankBic:                    t.PersonBankBic,
			PersonBankAccountNumber:          t.PersonBankAccountNumber,
			CommitteePaymentAccountID:        t.CommitteePaymentAccountID,
			CommitteePaymentAccountLabel:     t.CommitteePaymentAccountLabel,
			CommitteeAccountPaidDate:         t.CommitteeAccountPaidDate,
			CommitteeAccountPaymentReference: t.CommitteeAccountPaymentReference,
			PaymentRequestBankAccountHolder:  t.PaymentRequestBankAccountHolder,
			PaymentRequestBankIban:           t.PaymentRequestBankIban,
			PaymentRequestBankBic:            t.PaymentRequestBankBic,
			PaymentRequestBankAccountNumber:  t.PaymentRequestBankAccountNumber,
		})
		if err != nil {
			if errors.Is(err, repository.ErrSubmissionAlreadyExists) {
				return nil, &ServerError{Err: err, Status: statusSubmissionAlreadyExists}
			}
			return nil, &ServerError{Err: err, Status: statusFailedCreateSubmission}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			(&gen.SubmissionResourceName{Organization: pn.Organization, Submission: m.ID.String()}).String(), orgID, m.ID,
		), AuditActionCreate, nil, m); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return submissionToProto(gen.SubmissionResourceName{Organization: pn.Organization, Submission: m.ID.String()}, m), nil
	})
}

// updateMaskPaths lists the update mask paths understood by UpdateSubmission.
// The nested paths name the type oneof branches, so a path both selects the
// fields to update and fixes the targeted type/direction/settlement.
var updateMaskPaths = []string{
	"committee",
	"notice",
	"type",
	"misc",
	"income_expense",
	"income_expense.scope",
	"income_expense.income",
	"income_expense.expense",
	"income_expense.expense.person",
	"income_expense.expense.committee_account",
	"income_expense.expense.payment_request",
}

// submissionUpdateMask classifies update mask paths for submissions: mutable
// paths drive the update, other known field paths (e.g. the output-only
// fields of a full-resource body) are ignored, unknown paths are rejected.
var submissionUpdateMask = newResourceMask(&gen.Submission{}, updateMaskPaths)

// scopeChanged reports whether an existing scope was replaced by a different
// one. Giving a scope to a submission that had none (or dropping it by
// switching the type) is not a scope change.
func scopeChanged(before, after model.SubmissionScope) bool {
	return before != model.SubmissionScopeNone && after != model.SubmissionScopeNone && before != after
}

func (s *submissionServiceServer) UpdateSubmission(ctx context.Context, req *gen.UpdateSubmissionRequest) (*gen.Submission, error) {
	if req.Submission == nil {
		return nil, &ServerError{Status: statusSubmissionRequired}
	}

	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Submission.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Submission, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Submission()
		committeeRepo := f.Committee()
		settingsRepo := f.OrganizationSubmissionSettings()
		audits := newAuditWriter(tx)

		m, orgID, err := s.loadSubmission(ctx, repo, n)
		if err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		fullUpdate := hasFullAction(ctx, s.enforcer, n.Organization, authz.ActionUpdate)
		if !fullUpdate {
			if err := checkSubmissionWrite(ctx, s.enforcer, n.Organization, m); err != nil {
				return nil, err
			}
		}

		if m.DeletedAt.Valid {
			return nil, &ServerError{Status: statusSubmissionDeleted}
		}
		switch m.Status {
		case model.SubmissionStatusDraft, model.SubmissionStatusPending, model.SubmissionStatusFurtherInfoRequired:
		default:
			return nil, &ServerError{Status: statusSubmissionNotEditable}
		}

		if req.Submission.Etag != "" && req.Submission.Etag != submissionToProto(n, m).GetEtag() {
			return nil, &ServerError{Status: statusEtagMismatch}
		}

		mask, err := submissionUpdateMask.resolve(req.UpdateMask.GetPaths())
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidUpdateMask}
		}
		// An empty mask replaces every mutable field (AIP-134).
		has := func(field string) bool { return len(mask) == 0 || slices.Contains(mask, field) }

		target := *m
		ie := req.Submission.GetIncomeExpense()

		if has("committee") {
			cid, err := parseCommitteeID(req.Submission.GetCommittee())
			if err != nil {
				return nil, &ServerError{Err: err, Status: statusInvalidCommitteeName}
			}
			target.CommitteeID = cid
		}
		if has("notice") {
			target.Notice = req.Submission.GetNotice()
		}

		// The type structure is applied according to the most specific masked
		// path; with an empty mask the full type from the request replaces the
		// stored one.
		switch {
		case len(mask) == 0 || slices.Contains(mask, "type"):
			if err := applySubmissionType(&target, req.Submission); err != nil {
				return nil, err
			}
		case slices.Contains(mask, "misc"):
			applySubmissionMiscType(&target)
		case slices.Contains(mask, "income_expense"):
			if ie == nil {
				return nil, &ServerError{Status: statusSubmissionTypeRequired}
			}
			if err := applySubmissionIncomeExpenseType(&target, ie); err != nil {
				return nil, err
			}
		case slices.Contains(mask, "income_expense.income"):
			applySubmissionIncomeSettlement(&target)
		case slices.Contains(mask, "income_expense.expense"),
			slices.Contains(mask, "income_expense.expense.person"),
			slices.Contains(mask, "income_expense.expense.committee_account"),
			slices.Contains(mask, "income_expense.expense.payment_request"):
			if err := applySubmissionExpenseSettlement(&target, ie.GetExpense()); err != nil {
				return nil, err
			}
		}
		if slices.Contains(mask, "income_expense.scope") {
			if ie == nil {
				return nil, &ServerError{Status: statusSubmissionTypeRequired}
			}
			target.Scope = submissionScopeFromProto(ie.GetScope())
		}

		// Changing the scope of an existing submission requires the treasury
		// update permission (submitters cannot change the scope after
		// creation).
		if !fullUpdate && scopeChanged(m.Scope, target.Scope) {
			return nil, &ServerError{Status: statusSubmissionScopeLocked}
		}

		committee, err := committeeRepo.GetByID(ctx, target.CommitteeID)
		if err != nil {
			if errors.Is(err, repository.ErrCommitteeNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteeNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedUpdateSubmission}
		}
		if target.Type == model.SubmissionTypeIncomeExpense && !committee.AllowScopeSelection {
			target.Scope = submissionScopeFromProto(gen.SubmissionScope_SUBMISSION_SCOPE_NONPROFIT)
		}

		if m.Status != model.SubmissionStatusDraft {
			// Submitted submissions must stay complete after the update; drafts
			// may keep unset settlements and details until :submit.
			if err := normalizeSubmissionDetails(ctx, committeeRepo, &target); err != nil {
				return nil, err
			}
			if err := s.checkSettlementEnabled(ctx, settingsRepo, orgID, target.SettlementType); err != nil {
				return nil, err
			}
		}

		params := diffSubmissionParams(m, &target)
		if err := repo.Update(ctx, m.ID, params); err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedUpdateSubmission}
		}

		after, err := repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			n.String(), orgID, m.ID,
		), AuditActionUpdate, m, after); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return submissionToProto(n, after), nil
	})
}

// diffSubmissionParams returns update params for every mutable column whose
// value differs between before and after. Nullable columns are expressed with
// optional pointer values, so a cleared switch stores NULL.
func diffSubmissionParams(before, after *model.Submission) repository.UpdateSubmissionParams {
	var p repository.UpdateSubmissionParams

	dateEq := func(a, b *time.Time) bool {
		return (a == nil) == (b == nil) && (a == nil || a.Equal(*b))
	}

	if before.CommitteeID != after.CommitteeID {
		p.CommitteeID = optional.From(after.CommitteeID)
	}
	if before.Type != after.Type {
		p.Type = optional.From(after.Type)
	}
	if before.Direction != after.Direction {
		p.Direction = optional.From(after.Direction)
	}
	if before.SettlementType != after.SettlementType {
		p.SettlementType = optional.From(after.SettlementType)
	}
	if before.Scope != after.Scope {
		p.Scope = optional.From(after.Scope)
	}
	if before.Notice != after.Notice {
		p.Notice = optional.From(after.Notice)
	}
	if before.PersonPayoutMethod != after.PersonPayoutMethod {
		p.PersonPayoutMethod = optional.From(after.PersonPayoutMethod)
	}
	if !ptrEq(before.PersonBankAccountHolder, after.PersonBankAccountHolder) {
		p.PersonBankAccountHolder = optional.From(after.PersonBankAccountHolder)
	}
	if !ptrEq(before.PersonBankIban, after.PersonBankIban) {
		p.PersonBankIban = optional.From(after.PersonBankIban)
	}
	if !ptrEq(before.PersonBankBic, after.PersonBankBic) {
		p.PersonBankBic = optional.From(after.PersonBankBic)
	}
	if !ptrEq(before.PersonBankAccountNumber, after.PersonBankAccountNumber) {
		p.PersonBankAccountNumber = optional.From(after.PersonBankAccountNumber)
	}
	if before.CommitteePaymentAccountID != after.CommitteePaymentAccountID {
		p.CommitteePaymentAccountID = optional.From(after.CommitteePaymentAccountID)
	}
	if !ptrEq(before.CommitteePaymentAccountLabel, after.CommitteePaymentAccountLabel) {
		p.CommitteePaymentAccountLabel = optional.From(after.CommitteePaymentAccountLabel)
	}
	if !dateEq(before.CommitteeAccountPaidDate, after.CommitteeAccountPaidDate) {
		p.CommitteeAccountPaidDate = optional.From(after.CommitteeAccountPaidDate)
	}
	if !ptrEq(before.CommitteeAccountPaymentReference, after.CommitteeAccountPaymentReference) {
		p.CommitteeAccountPaymentReference = optional.From(after.CommitteeAccountPaymentReference)
	}
	if !ptrEq(before.PaymentRequestBankAccountHolder, after.PaymentRequestBankAccountHolder) {
		p.PaymentRequestBankAccountHolder = optional.From(after.PaymentRequestBankAccountHolder)
	}
	if !ptrEq(before.PaymentRequestBankIban, after.PaymentRequestBankIban) {
		p.PaymentRequestBankIban = optional.From(after.PaymentRequestBankIban)
	}
	if !ptrEq(before.PaymentRequestBankBic, after.PaymentRequestBankBic) {
		p.PaymentRequestBankBic = optional.From(after.PaymentRequestBankBic)
	}
	if !ptrEq(before.PaymentRequestBankAccountNumber, after.PaymentRequestBankAccountNumber) {
		p.PaymentRequestBankAccountNumber = optional.From(after.PaymentRequestBankAccountNumber)
	}
	return p
}

func (s *submissionServiceServer) DeleteSubmission(ctx context.Context, req *gen.DeleteSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Submission, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Submission()
		audits := newAuditWriter(tx)

		m, orgID, err := s.loadSubmission(ctx, repo, n)
		if err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if err := checkSubmissionDelete(ctx, s.enforcer, n.Organization, m); err != nil {
			return nil, err
		}

		if err := repo.SoftDelete(ctx, m.ID, submissionPurgeRetention); err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedDeleteSubmission}
		}

		after, err := repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if err := audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), AuditActionDelete, m, after); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return submissionToProto(n, after), nil
	})
}

func (s *submissionServiceServer) UndeleteSubmission(ctx context.Context, req *gen.UndeleteSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Submission, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Submission()
		audits := newAuditWriter(tx)

		m, orgID, err := s.loadSubmission(ctx, repo, n)
		if err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if err := repo.Undelete(ctx, m.ID); err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedUndeleteSubmission}
		}

		after, err := repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if err := audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "undelete", after, nil); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return submissionToProto(n, after), nil
	})
}

// ── lifecycle verbs ──────────────────────────────────────────────────────────

func (s *submissionServiceServer) SubmitSubmission(ctx context.Context, req *gen.SubmitSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Submission, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Submission()
		committeeRepo := f.Committee()
		settingsRepo := f.OrganizationSubmissionSettings()
		audits := newAuditWriter(tx)

		m, orgID, err := s.loadSubmission(ctx, repo, n)
		if err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		fullUpdate := hasFullAction(ctx, s.enforcer, n.Organization, authz.ActionUpdate)
		if !fullUpdate {
			if err := checkSubmissionWrite(ctx, s.enforcer, n.Organization, m); err != nil {
				return nil, err
			}
		}

		if m.DeletedAt.Valid {
			return nil, &ServerError{Status: statusSubmissionDeleted}
		}
		if m.Status != model.SubmissionStatusDraft {
			return nil, &ServerError{Status: statusSubmissionInvalidTransition}
		}
		if err := s.checkSubmissionDeadline(ctx, settingsRepo, orgID, n.Organization); err != nil {
			return nil, err
		}

		// Completeness validation.
		if err := normalizeSubmissionDetails(ctx, committeeRepo, m); err != nil {
			return nil, err
		}
		if err := s.checkSettlementEnabled(ctx, settingsRepo, orgID, m.SettlementType); err != nil {
			return nil, err
		}
		// Persist the payment account label snapshot resolved by the
		// normalization above.
		if m.SettlementType.Valid && m.SettlementType.SubmissionSettlementType == model.SubmissionSettlementTypeCommitteeAccount && m.CommitteePaymentAccountLabel != nil {
			if err := repo.Update(ctx, m.ID, repository.UpdateSubmissionParams{
				CommitteePaymentAccountLabel: optional.From(m.CommitteePaymentAccountLabel),
			}); err != nil {
				return nil, &ServerError{Err: err, Status: statusFailedSubmitSubmission}
			}
		}
		items, err := repo.ListItems(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedSubmitSubmission}
		}
		if len(items) == 0 {
			return nil, &ServerError{Status: statusSubmissionItemsRequired}
		}

		if err := repo.UpdateStatus(ctx, m.ID, model.SubmissionStatusDraft, model.SubmissionStatusPending); err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionInvalidTransition}
			}
			return nil, &ServerError{Err: err, Status: statusFailedSubmitSubmission}
		}

		after, err := repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if err := audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "submit", m, after); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return submissionToProto(n, after), nil
	})
}

func (s *submissionServiceServer) ApproveSubmission(ctx context.Context, req *gen.ApproveSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Submission, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Submission()
		audits := newAuditWriter(tx)

		m, orgID, err := s.loadSubmission(ctx, repo, n)
		if err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if m.DeletedAt.Valid {
			return nil, &ServerError{Status: statusSubmissionDeleted}
		}
		if m.Status != model.SubmissionStatusPending && m.Status != model.SubmissionStatusFurtherInfoRequired {
			return nil, &ServerError{Status: statusSubmissionInvalidTransition}
		}

		// Misc document collections, income submissions and committee account
		// settlements are completed directly upon approval — no payout or
		// execution step remains.
		target := model.SubmissionStatusApproved
		isMisc := m.Type == model.SubmissionTypeMisc
		isIncome := m.Direction.Valid && m.Direction.SubmissionDirection == model.SubmissionDirectionIncome
		isCommitteeAccount := m.SettlementType.Valid && m.SettlementType.SubmissionSettlementType == model.SubmissionSettlementTypeCommitteeAccount
		if isMisc || isIncome || isCommitteeAccount {
			target = model.SubmissionStatusCompleted
		}

		if err := repo.UpdateStatus(ctx, m.ID, m.Status, target); err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionInvalidTransition}
			}
			return nil, &ServerError{Err: err, Status: statusFailedApproveSubmission}
		}

		s.recordSystemComment(ctx, repo, m.ID, req.Note, m.Status, target, true)

		after, err := repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if err := audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "approve", m, after); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return submissionToProto(n, after), nil
	})
}

func (s *submissionServiceServer) RejectSubmission(ctx context.Context, req *gen.RejectSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Submission, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Submission()
		audits := newAuditWriter(tx)

		m, orgID, err := s.loadSubmission(ctx, repo, n)
		if err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if m.DeletedAt.Valid {
			return nil, &ServerError{Status: statusSubmissionDeleted}
		}
		switch m.Status {
		case model.SubmissionStatusPending, model.SubmissionStatusFurtherInfoRequired, model.SubmissionStatusApproved:
		default:
			return nil, &ServerError{Status: statusSubmissionInvalidTransition}
		}
		if req.Reason == "" {
			return nil, &ServerError{Status: statusReasonRequired}
		}

		if err := repo.UpdateStatus(ctx, m.ID, m.Status, model.SubmissionStatusRejected); err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionInvalidTransition}
			}
			return nil, &ServerError{Err: err, Status: statusFailedRejectSubmission}
		}

		// The rejection reason is visible to the submitter.
		s.recordSystemComment(ctx, repo, m.ID, req.Reason, m.Status, model.SubmissionStatusRejected, false)

		after, err := repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if err := audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "reject", m, after); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return submissionToProto(n, after), nil
	})
}

func (s *submissionServiceServer) RequestFurtherInfo(ctx context.Context, req *gen.RequestFurtherInfoRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Submission, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Submission()
		audits := newAuditWriter(tx)

		m, orgID, err := s.loadSubmission(ctx, repo, n)
		if err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if m.DeletedAt.Valid {
			return nil, &ServerError{Status: statusSubmissionDeleted}
		}
		if m.Status != model.SubmissionStatusPending {
			return nil, &ServerError{Status: statusSubmissionInvalidTransition}
		}
		if req.Reason == "" {
			return nil, &ServerError{Status: statusReasonRequired}
		}

		if err := repo.UpdateStatus(ctx, m.ID, model.SubmissionStatusPending, model.SubmissionStatusFurtherInfoRequired); err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionInvalidTransition}
			}
			return nil, &ServerError{Err: err, Status: statusFailedRequestFurtherInfo}
		}

		// The requested information is visible to the submitter.
		s.recordSystemComment(ctx, repo, m.ID, req.Reason, m.Status, model.SubmissionStatusFurtherInfoRequired, false)

		after, err := repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if err := audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "requestFurtherInfo", m, after); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return submissionToProto(n, after), nil
	})
}

func (s *submissionServiceServer) CompleteSubmission(ctx context.Context, req *gen.CompleteSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Submission, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Submission()
		audits := newAuditWriter(tx)

		m, orgID, err := s.loadSubmission(ctx, repo, n)
		if err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if m.DeletedAt.Valid {
			return nil, &ServerError{Status: statusSubmissionDeleted}
		}
		if m.Status != model.SubmissionStatusApproved {
			return nil, &ServerError{Status: statusSubmissionInvalidTransition}
		}

		params := repository.UpdateSubmissionParams{
			CompletionPaidDate:         optional.From(protoToDate(req.PaidDate)),
			CompletionPaymentReference: optional.From(req.PaymentReference),
		}
		if err := repo.Update(ctx, m.ID, params); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedCompleteSubmission}
		}

		if err := repo.UpdateStatus(ctx, m.ID, model.SubmissionStatusApproved, model.SubmissionStatusCompleted); err != nil {
			if errors.Is(err, repository.ErrSubmissionNotFound) {
				return nil, &ServerError{Err: err, Status: statusSubmissionInvalidTransition}
			}
			return nil, &ServerError{Err: err, Status: statusFailedCompleteSubmission}
		}

		s.recordSystemComment(ctx, repo, m.ID, "", model.SubmissionStatusApproved, model.SubmissionStatusCompleted, true)

		after, err := repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
		}

		if err := audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "complete", m, after); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return submissionToProto(n, after), nil
	})
}

// recordSystemComment appends a treasury comment documenting a status
// transition (or the completion metadata). Comments with empty content are
// only recorded when they carry a status change.
func (s *submissionServiceServer) recordSystemComment(ctx context.Context, repo *repository.SubmissionRepository, submissionID uuid.UUID, content string, from, to model.SubmissionStatus, adminOnly bool) {
	if content == "" && from == to {
		return
	}
	comment := &model.SubmissionComment{
		SubmissionID: submissionID,
		Content:      content,
		IsAdminOnly:  adminOnly,
		StatusFrom:   int32(from),
		StatusTo:     int32(to),
	}
	if user, ok := authz.UserIDFromContext(ctx); ok {
		if uid, err := uuid.Parse(user); err == nil {
			comment.AuthorUserID = uuid.NullUUID{Valid: true, UUID: uid}
		}
	}
	// A missing author (system sweeper) is not representable in the comment
	// table; the audit log records the system action instead.
	_ = repo.CreateComment(ctx, comment)
}
