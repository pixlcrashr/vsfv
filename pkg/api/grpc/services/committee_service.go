package services

import (
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/theater-improrama/go-utils/optional"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

var (
	statusCommitteeRequired      = status.New(codes.InvalidArgument, "committee is required")
	statusInvalidCommitteeName   = status.New(codes.InvalidArgument, "invalid committee name")
	statusCommitteeNotFound      = status.New(codes.NotFound, "committee not found")
	statusCommitteeAlreadyExists = status.New(codes.AlreadyExists, "committee already exists")
	statusCommitteeInUse         = status.New(codes.FailedPrecondition, "committee is referenced by submissions")
	statusFailedGetCommittee     = status.New(codes.Internal, "failed to get committee")
	statusFailedListCommittees   = status.New(codes.Internal, "failed to list committees")
	statusFailedCreateCommittee  = status.New(codes.Internal, "failed to create committee")
	statusFailedUpdateCommittee  = status.New(codes.Internal, "failed to update committee")
	statusFailedDeleteCommittee  = status.New(codes.Internal, "failed to delete committee")
)

// committeeServiceServer implements gen.CommitteeServiceServer.
type committeeServiceServer struct {
	repo           *repository.CommitteeRepository
	submissionRepo *repository.SubmissionRepository
	audits         *auditWriter
	enforcer       *authz.Enforcer
}

func newCommitteeServiceServer(repo *repository.CommitteeRepository, submissionRepo *repository.SubmissionRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.CommitteeServiceServer {
	return &committeeServiceServer{repo: repo, submissionRepo: submissionRepo, audits: audits, enforcer: enforcer}
}

func CommitteePaymentAccountToProto(m model.CommitteePaymentAccount) *gen.CommitteePaymentAccount {
	return &gen.CommitteePaymentAccount{
		Uid:          m.ID.String(),
		Kind:         gen.PaymentAccountKind(m.Kind),
		DisplayLabel: m.DisplayLabel,
	}
}

func CommitteeToProto(m *model.Committee) *gen.Committee {
	c := &gen.Committee{
		Name:                (&gen.CommitteeResourceName{Organization: m.OrganizationID.String(), Committee: m.ID.String()}).String(),
		Uid:                 m.ID.String(),
		DisplayName:         m.DisplayName,
		DisplayDescription:  m.DisplayDescription,
		AllowScopeSelection: m.AllowScopeSelection,
		CreateTime:          nil,
		UpdateTime:          nil,
	}
	for _, pa := range m.PaymentAccounts {
		c.PaymentAccounts = append(c.PaymentAccounts, CommitteePaymentAccountToProto(pa))
	}
	return c
}

func (s *committeeServiceServer) GetCommittee(ctx context.Context, req *gen.GetCommitteeRequest) (*gen.Committee, error) {
	var n gen.CommitteeResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeName}
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCommitteeNotFound) {
			return nil, &ServerError{Err: err, Status: statusCommitteeNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetCommittee}
	}

	return CommitteeToProto(m), nil
}

func (s *committeeServiceServer) ListCommittees(ctx context.Context, req *gen.ListCommitteesRequest) (*gen.ListCommitteesResponse, error) {
	var pn gen.OrganizationResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	c, err := svcfilter.ParseCommitteeFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	pageSize := normalizePageSize(req.PageSize)
	offset, err := pagetoken.Decode(req.PageToken)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidPageToken}
	}

	ms, total, err := s.repo.List(ctx, repository.ListCommitteesParams{
		Cond:     c,
		Page:     int(offset/int64(pageSize)) + 1,
		PageSize: pageSize,
	})
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListCommittees}
	}

	resp := &gen.ListCommitteesResponse{TotalSize: total}
	for _, m := range ms {
		resp.Committees = append(resp.Committees, CommitteeToProto(m))
	}

	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}

	return resp, nil
}

func (s *committeeServiceServer) CreateCommittee(ctx context.Context, req *gen.CreateCommitteeRequest) (*gen.Committee, error) {
	if req.Committee == nil {
		return nil, &ServerError{Status: statusCommitteeRequired}
	}

	var pn gen.OrganizationResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionCreate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	params := repository.CreateCommitteeParams{
		OrganizationID:      orgID,
		DisplayName:         req.Committee.DisplayName,
		DisplayDescription:  req.Committee.DisplayDescription,
		AllowScopeSelection: req.Committee.AllowScopeSelection,
	}
	for _, pa := range req.Committee.PaymentAccounts {
		params.PaymentAccounts = append(params.PaymentAccounts, model.CommitteePaymentAccount{
			Kind:         model.PaymentAccountKind(pa.Kind),
			DisplayLabel: pa.DisplayLabel,
		})
	}

	m, err := s.repo.Create(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrCommitteeAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusCommitteeAlreadyExists}
		}
		return nil, &ServerError{Err: err, Status: statusFailedCreateCommittee}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		(&gen.CommitteeResourceName{Organization: orgID.String(), Committee: m.ID.String()}).String(), orgID, m.ID,
	), AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return CommitteeToProto(m), nil
}

func (s *committeeServiceServer) UpdateCommittee(ctx context.Context, req *gen.UpdateCommitteeRequest) (*gen.Committee, error) {
	if req.Committee == nil {
		return nil, &ServerError{Status: statusCommitteeRequired}
	}

	var n gen.CommitteeResourceName
	if err := n.UnmarshalString(req.Committee.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeName}
	}

	before, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCommitteeNotFound) {
			return nil, &ServerError{Err: err, Status: statusCommitteeNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetCommittee}
	}

	mask := req.UpdateMask.GetPaths()
	params := repository.UpdateCommitteeParams{}
	if len(mask) == 0 || slices.Contains(mask, "display_name") {
		params.DisplayName = optional.From(req.Committee.DisplayName)
	}
	if len(mask) == 0 || slices.Contains(mask, "display_description") {
		params.DisplayDescription = optional.From(req.Committee.DisplayDescription)
	}
	if len(mask) == 0 || slices.Contains(mask, "allow_scope_selection") {
		params.AllowScopeSelection = optional.From(req.Committee.AllowScopeSelection)
	}

	if err := s.repo.Update(ctx, id, params); err != nil {
		if errors.Is(err, repository.ErrCommitteeNotFound) {
			return nil, &ServerError{Err: err, Status: statusCommitteeNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedUpdateCommittee}
	}

	if len(mask) == 0 || slices.Contains(mask, "payment_accounts") {
		var accounts []model.CommitteePaymentAccount
		for _, pa := range req.Committee.PaymentAccounts {
			account := model.CommitteePaymentAccount{
				Kind:         model.PaymentAccountKind(pa.Kind),
				DisplayLabel: pa.DisplayLabel,
			}
			if paUid, err := uuid.Parse(pa.Uid); err == nil {
				// Echoed existing account — keep its ID so submission
				// references stay valid.
				account.ID = paUid
			}
			accounts = append(accounts, account)
		}
		if err := s.repo.ReplacePaymentAccounts(ctx, id, accounts); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedUpdateCommittee}
		}
	}

	after, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetCommittee}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		(&gen.CommitteeResourceName{Organization: n.Organization, Committee: id.String()}).String(),
		orgIDFromSegment(n.Organization), id,
	), AuditActionUpdate, before, after); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return CommitteeToProto(after), nil
}

func (s *committeeServiceServer) DeleteCommittee(ctx context.Context, req *gen.DeleteCommitteeRequest) (*emptypb.Empty, error) {
	var n gen.CommitteeResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeName}
	}

	count, err := s.submissionRepo.CountByCommittee(ctx, id)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedDeleteCommittee}
	}
	if count > 0 {
		return nil, &ServerError{Status: statusCommitteeInUse}
	}

	before, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCommitteeNotFound) {
			return nil, &ServerError{Err: err, Status: statusCommitteeNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetCommittee}
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrCommitteeNotFound) {
			return nil, &ServerError{Err: err, Status: statusCommitteeNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedDeleteCommittee}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		(&gen.CommitteeResourceName{Organization: n.Organization, Committee: id.String()}).String(),
		orgIDFromSegment(n.Organization), id,
	), AuditActionDelete, before, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}

// orgIDFromSegment parses the organization UUID segment of a resource name.
func orgIDFromSegment(org string) uuid.UUID {
	id, _ := uuid.Parse(org)
	return id
}
