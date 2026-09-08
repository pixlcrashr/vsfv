package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/reporttemplate"
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
	statusReportTemplateRequired      = status.New(codes.InvalidArgument, "report_template is required")
	statusInvalidReportTemplateName   = status.New(codes.InvalidArgument, "invalid report template name")
	statusReportTemplateNotFound      = status.New(codes.NotFound, "report template not found")
	statusReportTemplateAlreadyExists = status.New(codes.AlreadyExists, "report template with this ID already exists")
	statusFailedGetReportTemplate     = status.New(codes.Internal, "failed to get report template")
	statusFailedListReportTemplates   = status.New(codes.Internal, "failed to list report templates")
	statusFailedCreateReportTemplate  = status.New(codes.Internal, "failed to create report template")
	statusFailedUpdateReportTemplate  = status.New(codes.Internal, "failed to update report template")
	statusFailedDeleteReportTemplate  = status.New(codes.Internal, "failed to delete report template")
)

type reportTemplateServiceServer struct {
	gen.UnimplementedReportTemplateServiceServer
	repo     *repository.ReportTemplateRepository
	audits   *auditWriter
	enforcer *authz.Enforcer
}

func newReportTemplateServiceServer(repo *repository.ReportTemplateRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.ReportTemplateServiceServer {
	return &reportTemplateServiceServer{repo: repo, audits: audits, enforcer: enforcer}
}

func (s *reportTemplateServiceServer) GetReportTemplate(ctx context.Context, req *gen.GetReportTemplateRequest) (*gen.ReportTemplate, error) {
	var n gen.ReportTemplateResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportTemplateName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceReportTemplates, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.ReportTemplate)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportTemplateName}
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrReportTemplateNotFound) {
			return nil, &ServerError{Err: err, Status: statusReportTemplateNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetReportTemplate}
	}

	return ReportTemplateToProto(n.OrganizationResourceName(), m), nil
}

func (s *reportTemplateServiceServer) ListReportTemplates(ctx context.Context, req *gen.ListReportTemplatesRequest) (*gen.ListReportTemplatesResponse, error) {
	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceReportTemplates, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	c, err := svcfilter.ParseReportTemplateFilter(req.Filter)
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

	orderExprs, _ := order.Resolve(orderBy, repository.ReportTemplateOrderFieldMapper)

	params := repository.ListReportTemplatesParams{
		Page:     int(offset/int64(pageSize)) + 1,
		PageSize: pageSize,
		Cond:     c,
		OrderBy:  orderExprs,
	}

	ms, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListReportTemplates}
	}

	resp := &gen.ListReportTemplatesResponse{TotalSize: total}
	for _, m := range ms {
		resp.ReportTemplates = append(resp.ReportTemplates, ReportTemplateToProto(pn, m))
	}

	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}

	return resp, nil
}

func (s *reportTemplateServiceServer) CreateReportTemplate(ctx context.Context, req *gen.CreateReportTemplateRequest) (*gen.ReportTemplate, error) {
	if req.ReportTemplate == nil {
		return nil, &ServerError{Status: statusReportTemplateRequired}
	}

	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceReportTemplates, authz.ActionCreate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	m, err := s.repo.Create(ctx, repository.CreateReportTemplateParams{
		OrganizationID: orgID,
		DisplayName:    req.ReportTemplate.DisplayName,
		Template:       req.ReportTemplate.Template,
		CustomID:       req.ReportTemplateId,
	})
	if err != nil {
		if errors.Is(err, repository.ErrReportTemplateAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusReportTemplateAlreadyExists}
		}

		if errors.Is(err, repository.ErrOrganizationNotFound) {
			return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedCreateReportTemplate}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		pn.ReportTemplateResourceName(m.CustomID).String(), orgID, m.ID,
	), AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return ReportTemplateToProto(pn, m), nil
}

func (s *reportTemplateServiceServer) UpdateReportTemplate(ctx context.Context, req *gen.UpdateReportTemplateRequest) (*gen.ReportTemplate, error) {
	if req.ReportTemplate == nil {
		return nil, &ServerError{Status: statusReportTemplateRequired}
	}

	var n gen.ReportTemplateResourceName

	if err := n.UnmarshalString(req.ReportTemplate.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportTemplateName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceReportTemplates, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.ReportTemplate)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportTemplateName}
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrReportTemplateNotFound) {
			return nil, &ServerError{Err: err, Status: statusReportTemplateNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetReportTemplate}
	}

	before := *m

	updateParams := repository.UpdateReportTemplateParams{
		DisplayName: optional.From(req.ReportTemplate.DisplayName),
		Template:    optional.From(req.ReportTemplate.Template),
	}

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateReportTemplate}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateReportTemplate}
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportTemplateName}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return ReportTemplateToProto(n.OrganizationResourceName(), m), nil
}

func (s *reportTemplateServiceServer) DeleteReportTemplate(ctx context.Context, req *gen.DeleteReportTemplateRequest) (*emptypb.Empty, error) {
	var n gen.ReportTemplateResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportTemplateName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceReportTemplates, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.ReportTemplate)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportTemplateName}
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrReportTemplateNotFound) {
			return nil, &ServerError{Err: err, Status: statusReportTemplateNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetReportTemplate}
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrReportTemplateNotFound) {
			return nil, &ServerError{Err: err, Status: statusReportTemplateNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedDeleteReportTemplate}
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidReportTemplateName}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionDelete, m, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}

func (s *reportTemplateServiceServer) GenerateHtmlPreview(ctx context.Context, req *gen.GenerateHtmlPreviewRequest) (*gen.GenerateHtmlPreviewResponse, error) {
	if req.Template == "" {
		return nil, &ServerError{Status: status.New(codes.InvalidArgument, "template is required")}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceReportTemplates, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	html, err := reporttemplate.RenderTemplate(req.Template)
	if err != nil {
		return nil, &ServerError{Err: err, Status: status.New(codes.InvalidArgument, "failed to render template")}
	}

	return &gen.GenerateHtmlPreviewResponse{Html: html}, nil
}
