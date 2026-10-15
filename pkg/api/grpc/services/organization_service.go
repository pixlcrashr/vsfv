package services

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"go.einride.tech/aip/ordering"
	date "google.golang.org/genproto/googleapis/type/date"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"gorm.io/gorm"
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
	db       *gorm.DB
	enforcer *authz.Enforcer
}

func newOrganizationServiceServer(db *gorm.DB, enforcer *authz.Enforcer) gen.OrganizationServiceServer {
	return &organizationServiceServer{db: db, enforcer: enforcer}
}

// submissionSettingsToProto loads the submission settings of an organization
// and maps them to their proto representation. A missing row maps to default
// settings. The stored enabled settlement kinds are deliberately not exposed:
// the API surface currently only carries the deadline.
func (s *organizationServiceServer) submissionSettingsToProto(ctx context.Context, settingsRepo *repository.OrganizationSubmissionSettingsRepository, orgID uuid.UUID) *gen.OrganizationSubmissionSettings {
	settings, err := settingsRepo.GetOrDefault(ctx, orgID)
	if err != nil {
		return nil
	}
	out := &gen.OrganizationSubmissionSettings{}
	if settings.SubmissionDeadline != nil {
		d := settings.SubmissionDeadline
		out.SubmissionDeadline = &date.Date{Year: int32(d.Year()), Month: int32(d.Month()), Day: int32(d.Day())}
	}
	return out
}

// applySubmissionSettingsUpdate persists the submission settings from an
// UpdateOrganization request when the field mask covers them. The enabled
// settlement kinds are not part of the API surface anymore, so the stored
// configuration is preserved and only the deadline is updated.
func (s *organizationServiceServer) applySubmissionSettingsUpdate(ctx context.Context, settingsRepo *repository.OrganizationSubmissionSettingsRepository, orgID uuid.UUID, mask []string, settings *gen.OrganizationSubmissionSettings) error {
	if len(mask) != 0 && !slices.Contains(mask, "submission_settings") {
		return nil
	}
	if settings == nil {
		return nil
	}

	current, err := settingsRepo.GetOrDefault(ctx, orgID)
	if err != nil {
		return err
	}

	var deadline *time.Time
	if settings.SubmissionDeadline != nil {
		t := time.Date(int(settings.SubmissionDeadline.Year), time.Month(settings.SubmissionDeadline.Month), int(settings.SubmissionDeadline.Day), 0, 0, 0, 0, time.UTC)
		deadline = &t
	}

	_, err = settingsRepo.Upsert(ctx, orgID, current.EnabledSettlementKinds, deadline)
	return err
}

func (s *organizationServiceServer) GetOrganization(ctx context.Context, req *gen.GetOrganizationRequest) (*gen.Organization, error) {
	var n gen.OrganizationResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceOrganizations, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Organization, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Organization()
		settingsRepo := f.OrganizationSubmissionSettings()

		m, err := repo.GetByResourceName(ctx, n.Organization)
		if err != nil {
			if errors.Is(err, repository.ErrOrganizationNotFound) {
				return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedGetOrganization}
		}

		proto := OrganizationToProto(m)
		proto.SubmissionSettings = s.submissionSettingsToProto(ctx, settingsRepo, m.ID)
		return proto, nil
	})
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

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.ListOrganizationsResponse, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Organization()
		settingsRepo := f.OrganizationSubmissionSettings()

		ms, total, err := repo.List(ctx, params)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListOrganizations}
		}

		resp := &gen.ListOrganizationsResponse{TotalSize: total}
		for _, m := range ms {
			proto := OrganizationToProto(m)
			proto.SubmissionSettings = s.submissionSettingsToProto(ctx, settingsRepo, m.ID)
			resp.Organizations = append(resp.Organizations, proto)
		}

		nextOffset := offset + int64(len(ms))
		if nextOffset < total {
			resp.NextPageToken = pagetoken.Encode(nextOffset)
		}

		return resp, nil
	})
}

func (s *organizationServiceServer) CreateOrganization(ctx context.Context, req *gen.CreateOrganizationRequest) (*gen.Organization, error) {
	if req.Organization == nil {
		return nil, &ServerError{Status: statusOrganizationRequired}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceOrganizations, authz.ActionCreate); err != nil {
		return nil, authError(err)
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Organization, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Organization()
		audits := newAuditWriter(tx)

		m, err := repo.Create(ctx, repository.CreateOrganizationParams{
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

		if err := audits.Record(ctx, auditSubject{
			ResourceName: gen.OrganizationResourceName{Organization: m.CustomID}.String(),
			ResourceID:   m.ID,
		}, AuditActionCreate, nil, m); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return OrganizationToProto(m), nil
	})
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

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.Organization, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Organization()
		settingsRepo := f.OrganizationSubmissionSettings()
		audits := newAuditWriter(tx)

		m, err := repo.GetByID(ctx, id)
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

		if err := repo.Update(ctx, m.ID, updateParams); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedUpdateOrganization}
		}

		if err := s.applySubmissionSettingsUpdate(ctx, settingsRepo, m.ID, req.UpdateMask.GetPaths(), req.Organization.SubmissionSettings); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedUpdateOrganization}
		}

		// Refresh the model after update
		m, err = repo.GetByID(ctx, m.ID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedUpdateOrganization}
		}

		if err := audits.Record(ctx, auditSubject{
			ResourceName: gen.OrganizationResourceName{Organization: m.CustomID}.String(),
			ResourceID:   m.ID,
		}, AuditActionUpdate, &before, m); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return OrganizationToProto(m), nil
	})
}

func (s *organizationServiceServer) CheckOrganizationId(ctx context.Context, req *gen.CheckOrganizationIdRequest) (*gen.CheckOrganizationIdResponse, error) {
	if req.OrganizationId == "" {
		return nil, &ServerError{Status: statusOrganizationIDRequired}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceOrganizations, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.CheckOrganizationIdResponse, error) {
		repo := repository.NewFactory(tx, s.enforcer).Organization()

		exists, err := repo.ExistsByCustomID(ctx, req.OrganizationId)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedCheckOrganization}
		}

		return &gen.CheckOrganizationIdResponse{Available: !exists}, nil
	})
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

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*emptypb.Empty, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.Organization()
		audits := newAuditWriter(tx)

		m, err := repo.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, repository.ErrOrganizationNotFound) {
				return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedGetOrganization}
		}

		if err := repo.Delete(ctx, id); err != nil {
			if errors.Is(err, repository.ErrOrganizationNotFound) {
				return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedDeleteOrganization}
		}

		if err := audits.Record(ctx, auditSubject{
			ResourceName: gen.OrganizationResourceName{Organization: m.CustomID}.String(),
			ResourceID:   m.ID,
		}, AuditActionDelete, m, nil); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return &emptypb.Empty{}, nil
	})
}
