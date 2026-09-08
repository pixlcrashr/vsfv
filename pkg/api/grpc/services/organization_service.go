package services

import (
	"context"
	"errors"
	"time"

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
	statusOrganizationRequired      = status.New(codes.InvalidArgument, "organization is required")
	statusInvalidOrganizationName   = status.New(codes.InvalidArgument, "invalid organization name")
	statusOrganizationIDRequired    = status.New(codes.InvalidArgument, "organization_id is required")
	statusOrganizationAlreadyExists = status.New(codes.AlreadyExists, "organization with this ID already exists")
	statusFailedGetOrganization     = status.New(codes.Internal, "failed to get organization")
	statusFailedListOrganizations   = status.New(codes.Internal, "failed to list organizations")
	statusFailedCreateOrganization  = status.New(codes.Internal, "failed to create organization")
	statusFailedUpdateOrganization  = status.New(codes.Internal, "failed to update organization")
	statusFailedDeleteOrganization  = status.New(codes.Internal, "failed to delete organization")
	statusFailedCheckOrganization   = status.New(codes.Internal, "failed to check organization id")
)

type organizationServiceServer struct {
	gen.UnimplementedOrganizationServiceServer
	repo     *repository.OrganizationRepository
	audits   *auditWriter
	enforcer *authz.Enforcer
}

func newOrganizationServiceServer(repo *repository.OrganizationRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.OrganizationServiceServer {
	return &organizationServiceServer{repo: repo, audits: audits, enforcer: enforcer}
}

func (s *organizationServiceServer) GetOrganization(ctx context.Context, req *gen.GetOrganizationRequest) (*gen.Organization, error) {
	var n gen.OrganizationResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceOrganizations, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	m, err := s.repo.GetByResourceName(ctx, n.Organization)
	if err != nil {
		if errors.Is(err, repository.ErrOrganizationNotFound) {
			return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetOrganization}
	}

	return OrganizationToProto(m), nil
}

func (s *organizationServiceServer) ListOrganizations(ctx context.Context, req *gen.ListOrganizationsRequest) (*gen.ListOrganizationsResponse, error) {
	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceOrganizations, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	c, err := svcfilter.ParseOrganizationFilter(req.Filter)
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

	orderExprs, _ := order.Resolve(orderBy, repository.OrganizationOrderFieldMapper)

	params := repository.ListOrganizationsParams{
		Page:     int(offset/int64(pageSize)) + 1,
		PageSize: pageSize,
		Cond:     c,
		OrderBy:  orderExprs,
	}

	ms, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListOrganizations}
	}

	resp := &gen.ListOrganizationsResponse{TotalSize: total}
	for _, m := range ms {
		resp.Organizations = append(resp.Organizations, OrganizationToProto(m))
	}

	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}

	return resp, nil
}

func (s *organizationServiceServer) CreateOrganization(ctx context.Context, req *gen.CreateOrganizationRequest) (*gen.Organization, error) {
	if req.Organization == nil {
		return nil, &ServerError{Status: statusOrganizationRequired}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceOrganizations, authz.ActionCreate); err != nil {
		return nil, authError(err)
	}

	m, err := s.repo.Create(ctx, repository.CreateOrganizationParams{
		DisplayName:        req.Organization.DisplayName,
		DisplayDescription: req.Organization.DisplayDescription,
		StartMonth:         time.Month(req.Organization.StartMonth),
		CustomID:           req.OrganizationId,
	})
	if err != nil {
		if errors.Is(err, repository.ErrOrganizationAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusOrganizationAlreadyExists}
		}

		return nil, &ServerError{Err: err, Status: statusFailedCreateOrganization}
	}

	if err := s.audits.Record(ctx, auditSubject{
		ResourceName: gen.OrganizationResourceName{Organization: m.CustomID}.String(),
		ResourceID:   m.ID,
	}, AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return OrganizationToProto(m), nil
}

func (s *organizationServiceServer) UpdateOrganization(ctx context.Context, req *gen.UpdateOrganizationRequest) (*gen.Organization, error) {
	if req.Organization == nil {
		return nil, &ServerError{Status: statusOrganizationRequired}
	}

	var n gen.OrganizationResourceName

	if err := n.UnmarshalString(req.Organization.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceOrganizations, authz.ActionUpdate); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationName}
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrOrganizationNotFound) {
			return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetOrganization}
	}

	before := *m

	updateParams := repository.UpdateOrganizationParams{
		DisplayName:        optional.From(req.Organization.DisplayName),
		DisplayDescription: optional.From(req.Organization.DisplayDescription),
	}

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateOrganization}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateOrganization}
	}

	if err := s.audits.Record(ctx, auditSubject{
		ResourceName: gen.OrganizationResourceName{Organization: m.CustomID}.String(),
		ResourceID:   m.ID,
	}, AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return OrganizationToProto(m), nil
}

func (s *organizationServiceServer) CheckOrganizationId(ctx context.Context, req *gen.CheckOrganizationIdRequest) (*gen.CheckOrganizationIdResponse, error) {
	if req.OrganizationId == "" {
		return nil, &ServerError{Status: statusOrganizationIDRequired}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceOrganizations, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	exists, err := s.repo.ExistsByCustomID(ctx, req.OrganizationId)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedCheckOrganization}
	}

	return &gen.CheckOrganizationIdResponse{Available: !exists}, nil
}

func (s *organizationServiceServer) DeleteOrganization(ctx context.Context, req *gen.DeleteOrganizationRequest) (*emptypb.Empty, error) {
	var n gen.OrganizationResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceOrganizations, authz.ActionDelete); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationName}
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrOrganizationNotFound) {
			return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetOrganization}
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrOrganizationNotFound) {
			return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedDeleteOrganization}
	}

	if err := s.audits.Record(ctx, auditSubject{
		ResourceName: gen.OrganizationResourceName{Organization: m.CustomID}.String(),
		ResourceID:   m.ID,
	}, AuditActionDelete, m, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}
