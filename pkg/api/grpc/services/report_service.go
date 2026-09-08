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
	"go.einride.tech/aip/ordering"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

var (
	statusReportRequired      = status.New(codes.InvalidArgument, "report is required")
	statusInvalidReportName   = status.New(codes.InvalidArgument, "invalid report name")
	statusReportNotFound      = status.New(codes.NotFound, "report not found")
	statusReportAlreadyExists = status.New(codes.AlreadyExists, "report with this ID already exists")
	statusFailedGetReport     = status.New(codes.Internal, "failed to get report")
	statusFailedListReports   = status.New(codes.Internal, "failed to list reports")
	statusFailedCreateReport  = status.New(codes.Internal, "failed to create report")
	statusFailedDeleteReport  = status.New(codes.Internal, "failed to delete report")
)

type reportServiceServer struct {
	gen.UnimplementedReportServiceServer
	repo     *repository.ReportRepository
	audits   *auditWriter
	enforcer *authz.Enforcer
}

func newReportServiceServer(repo *repository.ReportRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.ReportServiceServer {
	return &reportServiceServer{repo: repo, audits: audits, enforcer: enforcer}
}

func (s *reportServiceServer) GetReport(ctx context.Context, req *gen.GetReportRequest) (*gen.Report, error) {
	var n gen.ReportResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceReports, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.Report)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportName}
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrReportNotFound) {
			return nil, &ServerError{Err: err, Status: statusReportNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetReport}
	}

	return ReportToProto(n.OrganizationResourceName(), m), nil
}

func (s *reportServiceServer) ListReports(ctx context.Context, req *gen.ListReportsRequest) (*gen.ListReportsResponse, error) {
	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceReports, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	c, err := svcfilter.ParseReportFilter(req.Filter)
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

	orderExprs, _ := order.Resolve(orderBy, repository.ReportOrderFieldMapper)

	params := repository.ListReportsParams{
		Page:     int(offset/int64(pageSize)) + 1,
		PageSize: pageSize,
		Cond:     c,
		OrderBy:  orderExprs,
	}

	ms, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListReports}
	}

	resp := &gen.ListReportsResponse{TotalSize: total}
	for _, m := range ms {
		resp.Reports = append(resp.Reports, ReportToProto(pn, m))
	}

	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}

	return resp, nil
}

func (s *reportServiceServer) CreateReport(ctx context.Context, req *gen.CreateReportRequest) (*gen.Report, error) {
	if req.Report == nil {
		return nil, &ServerError{Status: statusReportRequired}
	}

	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceReports, authz.ActionCreate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	m, err := s.repo.Create(ctx, repository.CreateReportParams{
		OrganizationID: orgID,
		DisplayName:    req.Report.DisplayName,
		CustomID:       req.ReportId,
	})
	if err != nil {
		if errors.Is(err, repository.ErrReportAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusReportAlreadyExists}
		}

		if errors.Is(err, repository.ErrOrganizationNotFound) {
			return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedCreateReport}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		pn.ReportResourceName(m.CustomID).String(), orgID, m.ID,
	), AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return ReportToProto(pn, m), nil
}

func (s *reportServiceServer) DeleteReport(ctx context.Context, req *gen.DeleteReportRequest) (*emptypb.Empty, error) {
	var n gen.ReportResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceReports, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.Report)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportName}
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrReportNotFound) {
			return nil, &ServerError{Err: err, Status: statusReportNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetReport}
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrReportNotFound) {
			return nil, &ServerError{Err: err, Status: statusReportNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedDeleteReport}
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportName}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionDelete, m, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}
