package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"go.einride.tech/aip/ordering"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var (
	statusInvalidAuditLogEntryName    = status.New(codes.InvalidArgument, "invalid audit log entry name")
	statusAuditLogEntryNotFound       = status.New(codes.NotFound, "audit log entry not found")
	statusFailedGetAuditLogEntry      = status.New(codes.Internal, "failed to get audit log entry")
	statusFailedListAuditLogEntries   = status.New(codes.Internal, "failed to list audit log entries")
	statusFailedResolveOrganization   = status.New(codes.Internal, "failed to resolve organization")
	statusFailedResolveAuditAccess    = status.New(codes.Internal, "failed to resolve audit log permissions")
	statusInvalidOrganizationInFilter = status.New(codes.InvalidArgument, "invalid organization in filter")
	statusInvalidActorInFilter        = status.New(codes.InvalidArgument, "invalid actor in filter")
)

type auditLogServiceServer struct {
	gen.UnimplementedAuditLogServiceServer
	repo     *repository.AuditLogEntryRepository
	orgRepo  *repository.OrganizationRepository
	enforcer *authz.Enforcer
}

func newAuditLogServiceServer(repo *repository.AuditLogEntryRepository, orgRepo *repository.OrganizationRepository, enforcer *authz.Enforcer) gen.AuditLogServiceServer {
	return &auditLogServiceServer{repo: repo, orgRepo: orgRepo, enforcer: enforcer}
}

// auditAccess describes the caller's effective audit log access. unrestricted
// means every entry is visible (wildcard org assignment). allowedOrgIDs lists
// the organizations whose entries are visible. A caller with neither has no
// audit log permission at all.
type auditAccess struct {
	unrestricted  bool
	allowedOrgIDs []uuid.UUID
}

// resolveAuditAccess computes the caller's audit log access. Callers must
// have passed the scope check beforehand.
func (s *auditLogServiceServer) resolveAuditAccess(ctx context.Context) (*auditAccess, error) {
	userID, ok := authz.UserIDFromContext(ctx)
	if !ok {
		return nil, authz.ErrUnauthenticated
	}

	everywhere, orgCustomIDs, err := s.enforcer.OrgDomainsWithPermission(userID, authz.ResourceAuditLogs, authz.ActionRead)
	if err != nil {
		return nil, err
	}

	if everywhere {
		return &auditAccess{unrestricted: true}, nil
	}

	access := &auditAccess{allowedOrgIDs: make([]uuid.UUID, 0, len(orgCustomIDs))}
	for _, customID := range orgCustomIDs {
		org, err := s.orgRepo.GetByResourceName(ctx, customID)
		if err != nil {
			// The organization may have been deleted since the assignment
			// was made; it simply contributes no visible entries.
			continue
		}
		access.allowedOrgIDs = append(access.allowedOrgIDs, org.ID)
	}
	return access, nil
}

func (s *auditLogServiceServer) GetAuditLogEntry(ctx context.Context, req *gen.GetAuditLogEntryRequest) (*gen.AuditLogEntry, error) {
	var n gen.AuditLogEntryResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAuditLogEntryName}
	}

	id, err := uuid.Parse(n.AuditLogEntry)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAuditLogEntryName}
	}

	if err := authz.CheckScopes(ctx, authz.ResourceAuditLogs, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrAuditLogEntryNotFound) {
			return nil, &ServerError{Err: err, Status: statusAuditLogEntryNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetAuditLogEntry}
	}

	var orgResourceName string
	if m.OrganizationID.Valid {
		org, err := s.orgRepo.GetByID(ctx, m.OrganizationID.UUID)
		if err == nil {
			if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAuditLogs, authz.ActionRead, authz.OrgDomain(org.CustomID)); err != nil {
				return nil, authError(err)
			}
			orgResourceName = organizationResourceName(org.CustomID)
		} else if !errors.Is(err, repository.ErrOrganizationNotFound) {
			return nil, &ServerError{Err: err, Status: statusFailedResolveOrganization}
		} else {
			// The organization is gone; entries survive but require
			// unrestricted audit access.
			access, err := s.resolveAuditAccess(ctx)
			if err != nil {
				return nil, authError(err)
			}
			if !access.unrestricted {
				return nil, &ServerError{Err: authz.ErrPermissionDenied, Status: statusPermissionDenied}
			}
		}
	} else {
		// Global entries (users, groups, organizations) require wildcard
		// audit access.
		access, err := s.resolveAuditAccess(ctx)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedResolveAuditAccess}
		}
		if !access.unrestricted {
			return nil, &ServerError{Err: authz.ErrPermissionDenied, Status: statusPermissionDenied}
		}
	}

	return AuditLogEntryToProto(m, orgResourceName), nil
}

func (s *auditLogServiceServer) ListAuditLogEntries(ctx context.Context, req *gen.ListAuditLogEntriesRequest) (*gen.ListAuditLogEntriesResponse, error) {
	if err := authz.CheckScopes(ctx, authz.ResourceAuditLogs, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	access, err := s.resolveAuditAccess(ctx)
	if err != nil {
		if errors.Is(err, authz.ErrUnauthenticated) {
			return nil, authError(err)
		}
		return nil, &ServerError{Err: err, Status: statusFailedResolveAuditAccess}
	}

	if !access.unrestricted && len(access.allowedOrgIDs) == 0 {
		return nil, authError(authz.ErrPermissionDenied)
	}

	c, err := svcfilter.ParseAuditLogEntryFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	filters, c, err := svcfilter.ExtractAuditLogEntryFilters(c)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	// Resolve the organization filter to a UUID and intersect it with the
	// caller's access restriction.
	var filterOrgID *uuid.UUID
	if filters.Organization != "" {
		var on gen.OrganizationResourceName
		if err := on.UnmarshalString(filters.Organization); err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInFilter}
		}
		org, err := s.orgRepo.GetByResourceName(ctx, on.Organization)
		if err != nil {
			if errors.Is(err, repository.ErrOrganizationNotFound) {
				// A filter for an unknown organization matches nothing.
				return &gen.ListAuditLogEntriesResponse{}, nil
			}
			return nil, &ServerError{Err: err, Status: statusFailedResolveOrganization}
		}
		filterOrgID = &org.ID
	}

	var orgRestriction []uuid.UUID
	switch {
	case access.unrestricted:
		if filterOrgID != nil {
			orgRestriction = []uuid.UUID{*filterOrgID}
		}
	case filterOrgID != nil:
		allowed := false
		for _, id := range access.allowedOrgIDs {
			if id == *filterOrgID {
				allowed = true
				break
			}
		}
		if !allowed {
			return &gen.ListAuditLogEntriesResponse{}, nil
		}
		orgRestriction = []uuid.UUID{*filterOrgID}
	default:
		orgRestriction = access.allowedOrgIDs
	}

	// Resolve the actor filter resource name to a UUID column condition.
	if filters.Actor != "" {
		var un gen.UserResourceName
		if err := un.UnmarshalString(filters.Actor); err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidActorInFilter}
		}
		actorID, err := uuid.Parse(un.User)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidActorInFilter}
		}
		actorCond := cond.Eq("actor_id", actorID)
		if c == nil || c.IsEmpty() {
			c = actorCond
		} else {
			c = cond.And(c, actorCond)
		}
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

	orderExprs, _ := order.Resolve(orderBy, repository.AuditLogEntryOrderFieldMapper)

	params := repository.ListAuditLogEntriesParams{
		Cond:            c,
		OrganizationIDs: orgRestriction,
		Page:            int(offset/int64(pageSize)) + 1,
		PageSize:        pageSize,
		OrderBy:         orderExprs,
	}

	ms, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListAuditLogEntries}
	}

	// Batch-resolve the organization resource names for the page.
	orgRNByID := make(map[uuid.UUID]string)
	for _, m := range ms {
		if !m.OrganizationID.Valid {
			continue
		}
		if _, ok := orgRNByID[m.OrganizationID.UUID]; ok {
			continue
		}
		org, err := s.orgRepo.GetByID(ctx, m.OrganizationID.UUID)
		if err != nil {
			continue
		}
		orgRNByID[org.ID] = organizationResourceName(org.CustomID)
	}

	resp := &gen.ListAuditLogEntriesResponse{TotalSize: total}
	for _, m := range ms {
		var orgRN string
		if m.OrganizationID.Valid {
			orgRN = orgRNByID[m.OrganizationID.UUID]
		}
		resp.AuditLogEntries = append(resp.AuditLogEntries, AuditLogEntryToProto(m, orgRN))
	}

	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}

	return resp, nil
}

// organizationResourceName builds the resource name for an organization
// custom ID.
func organizationResourceName(customID string) string {
	return gen.OrganizationResourceName{Organization: customID}.String()
}

// AuditLogEntryToProto maps an audit log entry model to its proto message.
// orgResourceName may be empty for entries of global resources.
func AuditLogEntryToProto(m *model.AuditLogEntry, orgResourceName string) *gen.AuditLogEntry {
	e := &gen.AuditLogEntry{
		Name:         gen.AuditLogEntryResourceName{AuditLogEntry: m.ID.String()}.String(),
		Uid:          m.ID.String(),
		Resource:     m.ResourceName,
		Organization: orgResourceName,
		Action:       auditActionToProto(m.Action),
		Timestamp:    ts(m.CreatedAt),
	}

	if m.ActorID.Valid {
		e.Actor = gen.UserResourceName{User: m.ActorID.UUID.String()}.String()
	}

	for _, c := range m.Changes {
		e.Changes = append(e.Changes, &gen.AuditLogEntry_Change{
			Field:    c.Field,
			OldValue: auditChangeString(c.OldValue),
			NewValue: auditChangeString(c.NewValue),
		})
	}

	return e
}

func auditChangeString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

// auditActionToProto maps the stored action string to the proto enum.
func auditActionToProto(s string) gen.AuditLogEntry_Action {
	if v, ok := gen.AuditLogEntry_Action_value["ACTION_"+s]; ok {
		return gen.AuditLogEntry_Action(v)
	}
	return gen.AuditLogEntry_ACTION_UNSPECIFIED
}
