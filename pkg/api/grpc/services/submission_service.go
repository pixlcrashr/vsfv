package services

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
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
)

var (
	statusSubmissionRequired               = status.New(codes.InvalidArgument, "submission is required")
	statusInvalidSubmissionName            = status.New(codes.InvalidArgument, "invalid submission name")
	statusSubmissionNotFound               = status.New(codes.NotFound, "submission not found")
	statusSubmissionAlreadyExists          = status.New(codes.AlreadyExists, "submission already exists")
	statusSubmissionDirectionRequired      = status.New(codes.InvalidArgument, "direction is required")
	statusSubmissionSettlementRequired     = status.New(codes.InvalidArgument, "settlement is required for expense submissions")
	statusSubmissionSettlementNotAllowed   = status.New(codes.InvalidArgument, "settlement details do not match the settlement kind")
	statusSubmissionSettlementDisabled     = status.New(codes.FailedPrecondition, "settlement kind is not enabled for this organization")
	statusSubmissionPersonDetailsRequired  = status.New(codes.InvalidArgument, "payout details are required for person settlements")
	statusSubmissionPaymentAccountInvalid  = status.New(codes.InvalidArgument, "payment account does not belong to the committee")
	statusSubmissionPaymentAccountRequired = status.New(codes.InvalidArgument, "payment account is required for committee account settlements")
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
	repo          *repository.SubmissionRepository
	committeeRepo *repository.CommitteeRepository
	settingsRepo  *repository.OrganizationSubmissionSettingsRepository
	audits        *auditWriter
	enforcer      *authz.Enforcer
}

func newSubmissionServiceServer(
	repo *repository.SubmissionRepository,
	committeeRepo *repository.CommitteeRepository,
	settingsRepo *repository.OrganizationSubmissionSettingsRepository,
	audits *auditWriter,
	enforcer *authz.Enforcer,
) gen.SubmissionServiceServer {
	return &submissionServiceServer{
		repo:          repo,
		committeeRepo: committeeRepo,
		settingsRepo:  settingsRepo,
		audits:        audits,
		enforcer:      enforcer,
	}
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

// ── deadline & validation helpers ────────────────────────────────────────────

// checkSubmissionDeadline enforces the organization-wide submission deadline.
// Callers holding the full update permission bypass it (grace handling).
func (s *submissionServiceServer) checkSubmissionDeadline(ctx context.Context, orgID uuid.UUID, orgSegment string) error {
	settings, err := s.settingsRepo.GetOrDefault(ctx, orgID)
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
func (s *submissionServiceServer) checkSettlementEnabled(ctx context.Context, orgID uuid.UUID, settlement model.Settlement) error {
	if settlement == model.SettlementUnspecified {
		return nil
	}
	settings, err := s.settingsRepo.GetOrDefault(ctx, orgID)
	if err != nil {
		return &ServerError{Err: err, Status: statusFailedGetSubmission}
	}
	if len(settings.EnabledSettlementKinds) == 0 {
		return nil
	}
	name := settlementName(settlement)
	for _, k := range settings.EnabledSettlementKinds {
		if k == name {
			return nil
		}
	}
	return &ServerError{Status: statusSubmissionSettlementDisabled}
}

// settlementName maps a settlement enum to its proto enum value name (the
// representation stored in organization submission settings).
func settlementName(s model.Settlement) string {
	switch s {
	case model.SettlementPerson:
		return "PERSON"
	case model.SettlementCommitteeAccount:
		return "COMMITTEE_ACCOUNT"
	case model.SettlementPaymentRequest:
		return "PAYMENT_REQUEST"
	default:
		return ""
	}
}

// parseCommitteeUID extracts the committee UUID from a committee resource name.
func parseCommitteeUID(name string) (uuid.UUID, error) {
	var cn gen.CommitteeResourceName
	if err := cn.UnmarshalString(name); err != nil {
		return uuid.Nil, err
	}
	return uuid.Parse(cn.Committee)
}

// normalizeSubmissionDetails validates and normalizes the settlement details
// of m against its direction/settlement and the committee's payment accounts.
// For committee account settlements the account label snapshot is resolved
// here.
func normalizeSubmissionDetails(ctx context.Context, committeeRepo *repository.CommitteeRepository, m *model.Submission) error {
	if m.Direction == model.DirectionUnspecified {
		return &ServerError{Status: statusSubmissionDirectionRequired}
	}
	if m.Direction == model.DirectionIncome {
		m.Settlement = model.SettlementUnspecified
		return nil
	}
	if m.Settlement == model.SettlementUnspecified {
		return &ServerError{Status: statusSubmissionSettlementRequired}
	}

	switch m.Settlement {
	case model.SettlementPerson:
		if m.PayoutMethod == model.PayoutMethodUnspecified {
			return &ServerError{Status: statusSubmissionPersonDetailsRequired}
		}
		if m.PayoutMethod == model.PayoutMethodBankTransfer && (m.BankAccountHolder == "" || m.BankIban == "") {
			return &ServerError{Status: statusSubmissionPersonDetailsRequired}
		}
	case model.SettlementCommitteeAccount:
		if m.PaymentAccountUID == (uuid.NullUUID{}) {
			return &ServerError{Status: statusSubmissionPaymentAccountRequired}
		}
		if m.AccountPaidDate == nil {
			return &ServerError{Status: statusSubmissionPaidDateRequired}
		}
		committee, err := committeeRepo.GetByID(ctx, m.CommitteeID)
		if err != nil {
			return &ServerError{Err: err, Status: statusSubmissionPaymentAccountInvalid}
		}
		for _, pa := range committee.PaymentAccounts {
			if pa.ID == m.PaymentAccountUID.UUID {
				m.PaymentAccountLabel = pa.DisplayLabel
				return nil
			}
		}
		return &ServerError{Status: statusSubmissionPaymentAccountInvalid}
	case model.SettlementPaymentRequest:
		if m.VendorName == "" || m.VendorIban == "" || m.VendorTiming == model.PaymentRequestTimingUnspecified {
			return &ServerError{Status: statusSubmissionVendorDetailsRequired}
		}
	}
	return nil
}

// computeSubmissionEtag derives an opaque etag from the submission's identity
// and last modification time.
func computeSubmissionEtag(m *model.Submission) string {
	h := fnv.New64a()
	fmt.Fprintf(h, "%s|%s", m.ID.String(), m.UpdatedAt.UTC().Format(time.RFC3339Nano))
	return strconv.FormatUint(h.Sum64(), 16)
}

// loadSubmission resolves a submission resource name into the model,
// verifying it exists (and is not purged).
func (s *submissionServiceServer) loadSubmission(ctx context.Context, n gen.SubmissionResourceName) (*model.Submission, uuid.UUID, error) {
	id, err := uuid.Parse(n.Submission)
	if err != nil {
		return nil, uuid.Nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}
	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, uuid.Nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}
	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, uuid.Nil, err
	}
	return m, orgID, nil
}

// ── proto mapping ────────────────────────────────────────────────────────────

func submissionToProto(n gen.SubmissionResourceName, m *model.Submission) *gen.Submission {
	p := &gen.Submission{
		Name:          n.String(),
		Uid:           m.ID.String(),
		PublicId:      m.PublicID,
		CreatedByUser: "users/" + m.CreatedByUserID.String(),
		Committee:     (&gen.CommitteeResourceName{Organization: n.Organization, Committee: m.CommitteeID.String()}).String(),
		Direction:     gen.Direction(m.Direction),
		Settlement:    gen.Settlement(m.Settlement),
		Scope:         gen.Scope(m.Scope),
		Status:        gen.SubmissionStatus(m.Status),
		Notice:        m.Notice,
		TotalAmount:   &gen.Decimal{Value: m.TotalAmount.String()},
		Etag:          computeSubmissionEtag(m),
		CreateTime:    timestamppb.New(m.CreatedAt),
		UpdateTime:    timestamppb.New(m.UpdatedAt),
	}
	if m.DeletedAt.Valid {
		p.DeleteTime = timestamppb.New(m.DeletedAt.Time)
	}
	if m.PurgeTime != nil {
		p.PurgeTime = timestamppb.New(*m.PurgeTime)
	}

	switch m.Settlement {
	case model.SettlementPerson:
		details := &gen.PersonDetails{
			PayoutMethod: gen.PayoutMethod(m.PayoutMethod),
		}
		if m.BankAccountHolder != "" || m.BankIban != "" {
			details.BankDetails = &gen.BankDetails{
				AccountHolder: m.BankAccountHolder,
				Iban:          m.BankIban,
				Bic:           m.BankBic,
			}
		}
		p.SettlementDetails = &gen.Submission_PersonDetails{PersonDetails: details}
	case model.SettlementCommitteeAccount:
		details := &gen.CommitteeAccountDetails{
			PaymentAccountUid:   m.PaymentAccountUID.UUID.String(),
			PaymentAccountLabel: m.PaymentAccountLabel,
			PaymentReference:    m.AccountPaymentReference,
		}
		if m.AccountPaidDate != nil {
			details.PaidDate = dateToProto(m.AccountPaidDate)
		}
		p.SettlementDetails = &gen.Submission_CommitteeAccountDetails{CommitteeAccountDetails: details}
	case model.SettlementPaymentRequest:
		p.SettlementDetails = &gen.Submission_PaymentRequestDetails{PaymentRequestDetails: &gen.PaymentRequestDetails{
			VendorName: m.VendorName,
			VendorIban: m.VendorIban,
			VendorBic:  m.VendorBic,
			Timing:     gen.PaymentRequestTiming(m.VendorTiming),
		}}
	}
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

	m, _, err := s.loadSubmission(ctx, n)
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
		d := model.Direction(gen.Direction_value[*filters.Direction])
		params.Direction = &d
	}
	if filters.Settlement != nil {
		st := model.Settlement(gen.Settlement_value[*filters.Settlement])
		params.Settlement = &st
	}
	if filters.Status != nil {
		st := model.SubmissionStatus(gen.SubmissionStatus_value[*filters.Status])
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

	ms, total, err := s.repo.List(ctx, params)
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

	committeeID, err := parseCommitteeUID(req.Submission.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}
	committee, err := s.committeeRepo.GetByID(ctx, committeeID)
	if err != nil {
		if errors.Is(err, repository.ErrCommitteeNotFound) {
			return nil, &ServerError{Err: err, Status: statusCommitteeNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedCreateSubmission}
	}

	if req.Submission.Direction == gen.Direction_DIRECTION_UNSPECIFIED {
		return nil, &ServerError{Status: statusSubmissionDirectionRequired}
	}

	user, _ := authz.UserIDFromContext(ctx)
	createdBy, err := uuid.Parse(user)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusUnauthenticated}
	}

	scope := model.Scope(req.Submission.Scope)
	if !committee.AllowScopeSelection {
		scope = model.ScopeNonprofit
	}
	if scope == model.ScopeUnspecified {
		scope = model.ScopeNonprofit
	}

	direction := model.Direction(req.Submission.Direction)
	settlement := model.Settlement(req.Submission.Settlement)
	if direction == model.DirectionIncome {
		settlement = model.SettlementUnspecified
	}

	if err := s.checkSettlementEnabled(ctx, orgID, settlement); err != nil {
		return nil, err
	}

	m, err := s.repo.Create(ctx, repository.CreateSubmissionParams{
		OrganizationID:  orgID,
		CreatedByUserID: createdBy,
		CommitteeID:     committeeID,
		Direction:       direction,
		Settlement:      settlement,
		Scope:           scope,
		Notice:          req.Submission.Notice,
	})
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusSubmissionAlreadyExists}
		}
		return nil, &ServerError{Err: err, Status: statusFailedCreateSubmission}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		(&gen.SubmissionResourceName{Organization: pn.Organization, Submission: m.ID.String()}).String(), orgID, m.ID,
	), AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return submissionToProto(gen.SubmissionResourceName{Organization: pn.Organization, Submission: m.ID.String()}, m), nil
}

func (s *submissionServiceServer) UpdateSubmission(ctx context.Context, req *gen.UpdateSubmissionRequest) (*gen.Submission, error) {
	if req.Submission == nil {
		return nil, &ServerError{Status: statusSubmissionRequired}
	}

	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Submission.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	m, orgID, err := s.loadSubmission(ctx, n)
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

	if req.Submission.Etag != "" && req.Submission.Etag != computeSubmissionEtag(m) {
		return nil, &ServerError{Status: statusEtagMismatch}
	}

	mask := req.UpdateMask.GetPaths()
	has := func(field string) bool { return len(mask) == 0 || slices.Contains(mask, field) }

	// Scope changes after creation require the treasury update permission.
	if has("scope") && gen.Scope(m.Scope) != req.Submission.Scope && !fullUpdate {
		return nil, &ServerError{Status: statusSubmissionScopeLocked}
	}

	params := repository.UpdateSubmissionParams{}
	if has("committee") {
		if cid, err := parseCommitteeUID(req.Submission.Committee); err == nil && cid != m.CommitteeID {
			params.CommitteeID = optional.From(cid)
		}
	}
	if has("direction") {
		params.Direction = optional.From(model.Direction(req.Submission.Direction))
	}
	if has("settlement") {
		params.Settlement = optional.From(model.Settlement(req.Submission.Settlement))
	}
	if has("scope") {
		params.Scope = optional.From(model.Scope(req.Submission.Scope))
	}
	if has("notice") {
		params.Notice = optional.From(req.Submission.Notice)
	}
	if has("person_details") && req.Submission.GetPersonDetails() != nil {
		details := req.Submission.GetPersonDetails()
		params.PayoutMethod = optional.From(model.PayoutMethod(details.PayoutMethod))
		if details.BankDetails != nil {
			params.BankAccountHolder = optional.From(details.BankDetails.AccountHolder)
			params.BankIban = optional.From(details.BankDetails.Iban)
			params.BankBic = optional.From(details.BankDetails.Bic)
		}
	}
	if has("committee_account_details") && req.Submission.GetCommitteeAccountDetails() != nil {
		details := req.Submission.GetCommitteeAccountDetails()
		if uid, err := uuid.Parse(details.PaymentAccountUid); err == nil {
			params.PaymentAccountUID = optional.From(uuid.NullUUID{Valid: true, UUID: uid})
		}
		if details.PaidDate != nil {
			params.AccountPaidDate = optional.From(protoToDate(details.PaidDate))
		}
		params.AccountPaymentReference = optional.From(details.PaymentReference)
	}
	if has("payment_request_details") && req.Submission.GetPaymentRequestDetails() != nil {
		details := req.Submission.GetPaymentRequestDetails()
		params.VendorName = optional.From(details.VendorName)
		params.VendorIban = optional.From(details.VendorIban)
		params.VendorBic = optional.From(details.VendorBic)
		params.VendorTiming = optional.From(model.PaymentRequestTiming(details.Timing))
	}

	target := *m
	applySubmissionParams(&target, params)

	committee, err := s.committeeRepo.GetByID(ctx, target.CommitteeID)
	if err != nil {
		if errors.Is(err, repository.ErrCommitteeNotFound) {
			return nil, &ServerError{Err: err, Status: statusCommitteeNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedUpdateSubmission}
	}
	if !committee.AllowScopeSelection {
		target.Scope = model.ScopeNonprofit
	}
	if err := normalizeSubmissionDetails(ctx, s.committeeRepo, &target); err != nil {
		return nil, err
	}
	if err := s.checkSettlementEnabled(ctx, orgID, target.Settlement); err != nil {
		return nil, err
	}

	if err := s.repo.Update(ctx, m.ID, params); err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedUpdateSubmission}
	}

	// Persist the committee account label snapshot.
	if target.Settlement == model.SettlementCommitteeAccount && target.PaymentAccountLabel != m.PaymentAccountLabel {
		if err := s.repo.Update(ctx, m.ID, repository.UpdateSubmissionParams{
			PaymentAccountLabel: optional.From(target.PaymentAccountLabel),
		}); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedUpdateSubmission}
		}
	}

	after, err := s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionUpdate, m, after); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return submissionToProto(n, after), nil
}

// applySubmissionParams mirrors the optional update params onto a model copy
// so validation sees the post-update state.
func applySubmissionParams(m *model.Submission, params repository.UpdateSubmissionParams) {
	if params.CommitteeID.IsSet {
		m.CommitteeID = params.CommitteeID.Value
	}
	if params.Direction.IsSet {
		m.Direction = params.Direction.Value
	}
	if params.Settlement.IsSet {
		m.Settlement = params.Settlement.Value
	}
	if params.Scope.IsSet {
		m.Scope = params.Scope.Value
	}
	if params.Notice.IsSet {
		m.Notice = params.Notice.Value
	}
	if params.PayoutMethod.IsSet {
		m.PayoutMethod = params.PayoutMethod.Value
	}
	if params.BankAccountHolder.IsSet {
		m.BankAccountHolder = params.BankAccountHolder.Value
	}
	if params.BankIban.IsSet {
		m.BankIban = params.BankIban.Value
	}
	if params.BankBic.IsSet {
		m.BankBic = params.BankBic.Value
	}
	if params.PaymentAccountUID.IsSet {
		m.PaymentAccountUID = params.PaymentAccountUID.Value
	}
	if params.AccountPaidDate.IsSet {
		m.AccountPaidDate = params.AccountPaidDate.Value
	}
	if params.AccountPaymentReference.IsSet {
		m.AccountPaymentReference = params.AccountPaymentReference.Value
	}
	if params.VendorName.IsSet {
		m.VendorName = params.VendorName.Value
	}
	if params.VendorIban.IsSet {
		m.VendorIban = params.VendorIban.Value
	}
	if params.VendorBic.IsSet {
		m.VendorBic = params.VendorBic.Value
	}
	if params.VendorTiming.IsSet {
		m.VendorTiming = params.VendorTiming.Value
	}
}

func (s *submissionServiceServer) DeleteSubmission(ctx context.Context, req *gen.DeleteSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	m, orgID, err := s.loadSubmission(ctx, n)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
	}

	if err := checkSubmissionDelete(ctx, s.enforcer, n.Organization, m); err != nil {
		return nil, err
	}

	if err := s.repo.SoftDelete(ctx, m.ID, submissionPurgeRetention); err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedDeleteSubmission}
	}

	after, err := s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), AuditActionDelete, m, after); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return submissionToProto(n, after), nil
}

func (s *submissionServiceServer) UndeleteSubmission(ctx context.Context, req *gen.UndeleteSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	m, orgID, err := s.loadSubmission(ctx, n)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
	}

	if err := s.repo.Undelete(ctx, m.ID); err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedUndeleteSubmission}
	}

	after, err := s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "undelete", after, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return submissionToProto(n, after), nil
}

// ── lifecycle verbs ──────────────────────────────────────────────────────────

func (s *submissionServiceServer) SubmitSubmission(ctx context.Context, req *gen.SubmitSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	m, orgID, err := s.loadSubmission(ctx, n)
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
	if err := s.checkSubmissionDeadline(ctx, orgID, n.Organization); err != nil {
		return nil, err
	}

	// Completeness validation.
	if err := normalizeSubmissionDetails(ctx, s.committeeRepo, m); err != nil {
		return nil, err
	}
	if err := s.checkSettlementEnabled(ctx, orgID, m.Settlement); err != nil {
		return nil, err
	}
	items, err := s.repo.ListItems(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedSubmitSubmission}
	}
	if len(items) == 0 {
		return nil, &ServerError{Status: statusSubmissionItemsRequired}
	}

	if err := s.repo.UpdateStatus(ctx, m.ID, model.SubmissionStatusDraft, model.SubmissionStatusPending); err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionInvalidTransition}
		}
		return nil, &ServerError{Err: err, Status: statusFailedSubmitSubmission}
	}

	after, err := s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "submit", m, after); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return submissionToProto(n, after), nil
}

func (s *submissionServiceServer) ApproveSubmission(ctx context.Context, req *gen.ApproveSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	m, orgID, err := s.loadSubmission(ctx, n)
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

	// Committee account settlements and income submissions are completed
	// directly upon approval — no payout/execution step remains.
	target := model.SubmissionStatusApproved
	if m.Direction == model.DirectionIncome || m.Settlement == model.SettlementCommitteeAccount {
		target = model.SubmissionStatusCompleted
	}

	if err := s.repo.UpdateStatus(ctx, m.ID, m.Status, target); err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionInvalidTransition}
		}
		return nil, &ServerError{Err: err, Status: statusFailedApproveSubmission}
	}

	s.recordSystemComment(ctx, m.ID, req.Note, m.Status, target, true)

	after, err := s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "approve", m, after); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return submissionToProto(n, after), nil
}

func (s *submissionServiceServer) RejectSubmission(ctx context.Context, req *gen.RejectSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	m, orgID, err := s.loadSubmission(ctx, n)
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

	if err := s.repo.UpdateStatus(ctx, m.ID, m.Status, model.SubmissionStatusRejected); err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionInvalidTransition}
		}
		return nil, &ServerError{Err: err, Status: statusFailedRejectSubmission}
	}

	// The rejection reason is visible to the submitter.
	s.recordSystemComment(ctx, m.ID, req.Reason, m.Status, model.SubmissionStatusRejected, false)

	after, err := s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "reject", m, after); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return submissionToProto(n, after), nil
}

func (s *submissionServiceServer) RequestFurtherInfo(ctx context.Context, req *gen.RequestFurtherInfoRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	m, orgID, err := s.loadSubmission(ctx, n)
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

	if err := s.repo.UpdateStatus(ctx, m.ID, model.SubmissionStatusPending, model.SubmissionStatusFurtherInfoRequired); err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionInvalidTransition}
		}
		return nil, &ServerError{Err: err, Status: statusFailedRequestFurtherInfo}
	}

	// The requested information is visible to the submitter.
	s.recordSystemComment(ctx, m.ID, req.Reason, m.Status, model.SubmissionStatusFurtherInfoRequired, false)

	after, err := s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "requestFurtherInfo", m, after); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return submissionToProto(n, after), nil
}

func (s *submissionServiceServer) CompleteSubmission(ctx context.Context, req *gen.CompleteSubmissionRequest) (*gen.Submission, error) {
	var n gen.SubmissionResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceSubmissions, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	m, orgID, err := s.loadSubmission(ctx, n)
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
	if err := s.repo.Update(ctx, m.ID, params); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedCompleteSubmission}
	}

	if err := s.repo.UpdateStatus(ctx, m.ID, model.SubmissionStatusApproved, model.SubmissionStatusCompleted); err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionInvalidTransition}
		}
		return nil, &ServerError{Err: err, Status: statusFailedCompleteSubmission}
	}

	s.recordSystemComment(ctx, m.ID, "", model.SubmissionStatusApproved, model.SubmissionStatusCompleted, true)

	after, err := s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmission}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(n.String(), orgID, m.ID), "complete", m, after); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return submissionToProto(n, after), nil
}

// recordSystemComment appends a treasury comment documenting a status
// transition (or the completion metadata). Comments with empty content are
// only recorded when they carry a status change.
func (s *submissionServiceServer) recordSystemComment(ctx context.Context, submissionID uuid.UUID, content string, from, to model.SubmissionStatus, adminOnly bool) {
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
	_ = s.repo.CreateComment(ctx, comment)
}
