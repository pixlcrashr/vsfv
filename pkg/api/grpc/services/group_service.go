package services

import (
	"context"
	"errors"

	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
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
	statusGroupRequired      = status.New(codes.InvalidArgument, "group is required")
	statusInvalidGroupName   = status.New(codes.InvalidArgument, "invalid group name")
	statusGroupNotFound      = status.New(codes.NotFound, "group not found")
	statusGroupAlreadyExists = status.New(codes.AlreadyExists, "group with this ID already exists")
	statusFailedGetGroup     = status.New(codes.Internal, "failed to get group")
	statusFailedListGroups   = status.New(codes.Internal, "failed to list groups")
	statusFailedCreateGroup  = status.New(codes.Internal, "failed to create group")
	statusFailedUpdateGroup  = status.New(codes.Internal, "failed to update group")
	statusFailedDeleteGroup  = status.New(codes.Internal, "failed to delete group")
)

type groupServiceServer struct {
	gen.UnimplementedGroupServiceServer
	repo     *repository.UserGroupRepository
	audits   *auditWriter
	enforcer *authz.Enforcer
}

func newGroupServiceServer(repo *repository.UserGroupRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.GroupServiceServer {
	return &groupServiceServer{repo: repo, audits: audits, enforcer: enforcer}
}

func (s *groupServiceServer) GetGroup(ctx context.Context, req *gen.GetGroupRequest) (*gen.Group, error) {
	var n gen.GroupResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidGroupName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceGroups, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	m, err := s.repo.GetByResourceName(ctx, n.Group)
	if err != nil {
		if errors.Is(err, repository.ErrUserGroupNotFound) {
			return nil, &ServerError{Err: err, Status: statusGroupNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetGroup}
	}

	orgs, perms, err := s.buildGroupPermissions(ctx, m)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetGroup}
	}

	return UserGroupToProto(m, orgs, perms), nil
}

func (s *groupServiceServer) ListGroups(ctx context.Context, req *gen.ListGroupsRequest) (*gen.ListGroupsResponse, error) {
	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceGroups, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	c, err := filter.ParseUserGroupFilter(req.Filter)
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

	orderExprs, _ := order.Resolve(orderBy, repository.UserGroupOrderFieldMapper)

	params := repository.ListUserGroupsParams{
		Cond:     c,
		Page:     int(offset/int64(pageSize)) + 1,
		PageSize: pageSize,
		OrderBy:  orderExprs,
	}

	ms, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListGroups}
	}

	resp := &gen.ListGroupsResponse{TotalSize: total}
	for _, m := range ms {
		orgs, perms, err := s.buildGroupPermissions(ctx, m)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListGroups}
		}
		resp.Groups = append(resp.Groups, UserGroupToProto(m, orgs, perms))
	}

	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}

	return resp, nil
}

func (s *groupServiceServer) CreateGroup(ctx context.Context, req *gen.CreateGroupRequest) (*gen.Group, error) {
	if req.Group == nil {
		return nil, &ServerError{Status: statusGroupRequired}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceGroups, authz.ActionCreate); err != nil {
		return nil, authError(err)
	}

	params := repository.CreateUserGroupParams{
		DisplayName:        req.Group.DisplayName,
		DisplayDescription: req.Group.DisplayDescription,
		CustomID:           req.GroupId,
		Organizations:      req.Group.Organizations,
		Permissions:        req.Group.Permissions,
	}

	m, err := s.repo.Create(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrUserGroupAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusGroupAlreadyExists}
		}
		return nil, &ServerError{Err: err, Status: statusFailedCreateGroup}
	}

	if err := s.audits.Record(ctx, groupAuditSubject(m), AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	orgs, perms, err := s.buildGroupPermissions(ctx, m)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedCreateGroup}
	}

	return UserGroupToProto(m, orgs, perms), nil
}

func (s *groupServiceServer) UpdateGroup(ctx context.Context, req *gen.UpdateGroupRequest) (*gen.Group, error) {
	if req.Group == nil {
		return nil, &ServerError{Status: statusGroupRequired}
	}

	var n gen.GroupResourceName
	if err := n.UnmarshalString(req.Group.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidGroupName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceGroups, authz.ActionUpdate); err != nil {
		return nil, authError(err)
	}

	m, err := s.repo.GetByResourceName(ctx, n.Group)
	if err != nil {
		if errors.Is(err, repository.ErrUserGroupNotFound) {
			return nil, &ServerError{Err: err, Status: statusGroupNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetGroup}
	}

	before := *m
	oldOrgs, oldPerms, err := s.buildGroupPermissions(ctx, m)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetGroup}
	}

	updateParams := repository.UpdateUserGroupParams{}

	if req.Group.DisplayName != "" {
		updateParams.DisplayName = optional.From(req.Group.DisplayName)
	}
	if req.Group.DisplayDescription != "" {
		updateParams.DisplayDescription = optional.From(req.Group.DisplayDescription)
	}
	updateParams.Organizations = optional.From(req.Group.Organizations)
	updateParams.Permissions = optional.From(req.Group.Permissions)

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateGroup}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateGroup}
	}

	// The model diff only covers columns; organization assignments and
	// permissions live in casbin and are audited explicitly.
	changes, err := diffAuditModels(&before, m)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}
	if updateParams.Organizations.IsSet {
		changes = append(changes, stringSliceChange("organizations", oldOrgs, req.Group.Organizations))
	}
	if updateParams.Permissions.IsSet {
		changes = append(changes, stringSliceChange("permissions", oldPerms, req.Group.Permissions))
	}
	if err := s.audits.RecordChanges(ctx, groupAuditSubject(m), AuditActionUpdate, changes); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	orgs, perms, err := s.buildGroupPermissions(ctx, m)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateGroup}
	}

	return UserGroupToProto(m, orgs, perms), nil
}

func (s *groupServiceServer) DeleteGroup(ctx context.Context, req *gen.DeleteGroupRequest) (*emptypb.Empty, error) {
	var n gen.GroupResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidGroupName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceGroups, authz.ActionDelete); err != nil {
		return nil, authError(err)
	}

	m, err := s.repo.GetByResourceName(ctx, n.Group)
	if err != nil {
		if errors.Is(err, repository.ErrUserGroupNotFound) {
			return nil, &ServerError{Err: err, Status: statusGroupNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedDeleteGroup}
	}

	if err := s.repo.Delete(ctx, m.ID); err != nil {
		if errors.Is(err, repository.ErrUserGroupNotFound) {
			return nil, &ServerError{Err: err, Status: statusGroupNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedDeleteGroup}
	}

	if err := s.audits.Record(ctx, groupAuditSubject(m), AuditActionDelete, m, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}

func (s *groupServiceServer) AddUserToGroup(ctx context.Context, req *gen.AddUserToGroupRequest) (*emptypb.Empty, error) {
	var gn gen.GroupResourceName
	if err := gn.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidGroupName}
	}

	var un gen.UserResourceName
	if err := un.UnmarshalString(req.User); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidUserName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceGroups, authz.ActionUpdate); err != nil {
		return nil, authError(err)
	}

	group, err := s.repo.GetByResourceName(ctx, gn.Group)
	if err != nil {
		if errors.Is(err, repository.ErrUserGroupNotFound) {
			return nil, &ServerError{Err: err, Status: statusGroupNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetGroup}
	}

	if _, err := s.enforcer.AddGlobalGroupingPolicy(un.User, group.ID.String()); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateGroup}
	}

	// Membership is stored in casbin only; audit it as a group update.
	if err := s.audits.RecordChanges(ctx, groupAuditSubject(group), AuditActionUpdate, []model.AuditLogEntryChange{
		{Field: "members", NewValue: &un.User},
	}); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}

func (s *groupServiceServer) RemoveUserFromGroup(ctx context.Context, req *gen.RemoveUserFromGroupRequest) (*emptypb.Empty, error) {
	var gn gen.GroupResourceName
	if err := gn.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidGroupName}
	}

	var un gen.UserResourceName
	if err := un.UnmarshalString(req.User); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidUserName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceGroups, authz.ActionUpdate); err != nil {
		return nil, authError(err)
	}

	group, err := s.repo.GetByResourceName(ctx, gn.Group)
	if err != nil {
		if errors.Is(err, repository.ErrUserGroupNotFound) {
			return nil, &ServerError{Err: err, Status: statusGroupNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetGroup}
	}

	if _, err := s.enforcer.RemoveGlobalGroupingPolicy(un.User, group.ID.String()); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateGroup}
	}

	// Membership is stored in casbin only; audit it as a group update.
	if err := s.audits.RecordChanges(ctx, groupAuditSubject(group), AuditActionUpdate, []model.AuditLogEntryChange{
		{Field: "members", OldValue: &un.User},
	}); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}

// groupAuditSubject builds the audit subject for a user group ("Group"
// resource, global scope).
func groupAuditSubject(m *model.UserGroup) auditSubject {
	return auditSubject{
		ResourceName: gen.GroupResourceName{Group: m.CustomID}.String(),
		ResourceID:   m.ID,
	}
}

// stringSliceChange builds an audit change for a replaced string list
// (e.g. group permissions or organization assignments).
// buildGroupPermissions reads the organization assignments and permissions
// for a group from the repository and returns them as string slices.
// If the group already has Organizations loaded (e.g. from List), those are
// used directly to avoid redundant casbin queries.
func (s *groupServiceServer) buildGroupPermissions(ctx context.Context, m *model.UserGroup) (organizations, permissions []string, err error) {
	if m.Organizations != nil {
		organizations = m.Organizations
	} else {
		organizations, err = s.repo.GetOrganizations(ctx, m.ID)
		if err != nil {
			return nil, nil, err
		}
	}
	permissions, err = s.repo.GetPermissions(m.ID.String())
	if err != nil {
		return nil, nil, err
	}
	return organizations, permissions, nil
}
