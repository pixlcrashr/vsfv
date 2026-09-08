package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"go.einride.tech/aip/ordering"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

var (
	statusLedgerYearRequired        = status.New(codes.InvalidArgument, "ledger_year is required")
	statusInvalidLedgerYearName     = status.New(codes.InvalidArgument, "invalid ledger year name")
	statusInvalidParentOrganization = status.New(codes.InvalidArgument, "invalid parent organization")
	statusLedgerYearNotFound        = status.New(codes.NotFound, "ledger year not found")
	statusLedgerYearAlreadyExists   = status.New(codes.AlreadyExists, "ledger year with this ID already exists")
	statusFailedGetLedgerYear       = status.New(codes.Internal, "failed to get ledger year")
	statusFailedListLedgerYears     = status.New(codes.Internal, "failed to list ledger years")
	statusFailedCreateLedgerYear    = status.New(codes.Internal, "failed to create ledger year")
	statusFailedCloseLedgerYear     = status.New(codes.Internal, "failed to close ledger year")
	statusFailedDeleteLedgerYear    = status.New(codes.Internal, "failed to delete ledger year")
)

type ledgerYearServiceServer struct {
	gen.UnimplementedLedgerYearServiceServer
	repo     *repository.LedgerYearRepository
	audits   *auditWriter
	enforcer *authz.Enforcer
}

func newLedgerYearServiceServer(repo *repository.LedgerYearRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.LedgerYearServiceServer {
	return &ledgerYearServiceServer{repo: repo, audits: audits, enforcer: enforcer}
}

func (s *ledgerYearServiceServer) GetLedgerYear(ctx context.Context, req *gen.GetLedgerYearRequest) (*gen.LedgerYear, error) {
	var n gen.LedgerYearResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidLedgerYearName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceLedgerYear, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	yearID, err := uuid.Parse(n.LedgerYear)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidLedgerYearName}
	}

	m, err := s.repo.GetByID(ctx, yearID)
	if err != nil {
		if errors.Is(err, repository.ErrLedgerYearNotFound) {
			return nil, &ServerError{Err: err, Status: statusLedgerYearNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetLedgerYear}
	}

	return LedgerYearToProto(n.OrganizationResourceName(), m), nil
}

func (s *ledgerYearServiceServer) ListLedgerYears(ctx context.Context, req *gen.ListLedgerYearsRequest) (*gen.ListLedgerYearsResponse, error) {
	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentOrganization}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceLedgerYear, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentOrganization}
	}

	c, err := svcfilter.ParseLedgerYearFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	offset, err := pagetoken.Decode(req.PageToken)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidPageToken}
	}

	pageSize := normalizePageSize(req.PageSize)

	// Parse order_by
	orderBy, err := ordering.ParseOrderBy(req)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrderBy}
	}

	orderExprs, _ := order.Resolve(orderBy, repository.LedgerYearOrderFieldMapper)

	params := repository.ListLedgerYearsParams{
		OrganizationID: orgID,
		Page:           int(offset/int64(pageSize)) + 1,
		PageSize:       pageSize,
		Cond:           c,
		OrderBy:        orderExprs,
	}

	ms, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListLedgerYears}
	}

	resp := &gen.ListLedgerYearsResponse{TotalSize: total}
	for _, m := range ms {
		resp.LedgerYears = append(resp.LedgerYears, LedgerYearToProto(pn, m))
	}

	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}

	return resp, nil
}

func (s *ledgerYearServiceServer) CreateLedgerYear(ctx context.Context, req *gen.CreateLedgerYearRequest) (*gen.LedgerYear, error) {
	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentOrganization}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceLedgerYear, authz.ActionCreate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentOrganization}
	}

	if req.LedgerYear == nil {
		return nil, &ServerError{Status: statusLedgerYearRequired}
	}

	m, err := s.repo.Create(ctx, repository.CreateLedgerYearParams{
		OrganizationID: orgID,
		Year:           int(req.LedgerYear.Year),
		IsClosed:       req.LedgerYear.IsClosed,
		CustomID:       req.LedgerYearId,
	})
	if err != nil {
		if errors.Is(err, repository.ErrLedgerYearAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusLedgerYearAlreadyExists}
		}

		if errors.Is(err, repository.ErrOrganizationNotFound) {
			return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedCreateLedgerYear}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		pn.LedgerYearResourceName(m.CustomID).String(), orgID, m.ID,
	), AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return LedgerYearToProto(pn, m), nil
}

func (s *ledgerYearServiceServer) CloseLedgerYear(ctx context.Context, req *gen.CloseLedgerYearRequest) (*gen.LedgerYear, error) {
	var n gen.LedgerYearResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidLedgerYearName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceLedgerYear, authz.ActionClose, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	yearID, err := uuid.Parse(n.LedgerYear)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidLedgerYearName}
	}

	m, err := s.repo.GetByID(ctx, yearID)
	if err != nil {
		if errors.Is(err, repository.ErrLedgerYearNotFound) {
			return nil, &ServerError{Err: err, Status: statusLedgerYearNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetLedgerYear}
	}

	before := *m

	updateParams := repository.UpdateLedgerYearParams{
		IsClosed: optional.From(true),
	}

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedCloseLedgerYear}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedCloseLedgerYear}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), yearID, m.ID,
	), AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return LedgerYearToProto(n.OrganizationResourceName(), m), nil
}

func (s *ledgerYearServiceServer) DeleteLedgerYear(ctx context.Context, req *gen.DeleteLedgerYearRequest) (*emptypb.Empty, error) {
	var n gen.LedgerYearResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidLedgerYearName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceLedgerYear, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	yearID, err := uuid.Parse(n.LedgerYear)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidLedgerYearName}
	}

	m, err := s.repo.GetByID(ctx, yearID)
	if err != nil {
		if errors.Is(err, repository.ErrLedgerYearNotFound) {
			return nil, &ServerError{Err: err, Status: statusLedgerYearNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetLedgerYear}
	}

	if err := s.repo.Delete(ctx, yearID); err != nil {
		if errors.Is(err, repository.ErrLedgerYearNotFound) {
			return nil, &ServerError{Err: err, Status: statusLedgerYearNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedDeleteLedgerYear}
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidLedgerYearName}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionDelete, m, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}
