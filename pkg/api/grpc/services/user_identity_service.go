package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

var (
	statusInvalidUserIdentityName  = status.New(codes.InvalidArgument, "invalid user identity name")
	statusInvalidParentUserName    = status.New(codes.InvalidArgument, "invalid parent user name")
	statusUserIdentityNotFound     = status.New(codes.NotFound, "user identity not found")
	statusFailedGetUserIdentity    = status.New(codes.Internal, "failed to get user identity")
	statusFailedListUserIdentities = status.New(codes.Internal, "failed to list user identities")
)

type userIdentityServiceServer struct {
	gen.UnimplementedUserIdentityServiceServer
	db       *gorm.DB
	enforcer *authz.Enforcer
}

func newUserIdentityServiceServer(db *gorm.DB, enforcer *authz.Enforcer) gen.UserIdentityServiceServer {
	return &userIdentityServiceServer{db: db, enforcer: enforcer}
}

func (s *userIdentityServiceServer) GetUserIdentity(ctx context.Context, req *gen.GetUserIdentityRequest) (*gen.UserIdentity, error) {
	var n gen.UserIdentityResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidUserIdentityName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceUsers, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	userID, err := uuid.Parse(n.User)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidUserIdentityName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.UserIdentity, error) {
		repo := repository.NewFactory(tx, s.enforcer).UserIdentity()

		m, err := repo.GetByCustomID(ctx, userID, n.Identity)
		if err != nil {
			if errors.Is(err, repository.ErrUserIdentityNotFound) {
				return nil, &ServerError{Err: err, Status: statusUserIdentityNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetUserIdentity}
		}

		return UserIdentityToProto(n.UserResourceName(), m), nil
	})
}

func (s *userIdentityServiceServer) ListUserIdentities(ctx context.Context, req *gen.ListUserIdentitiesRequest) (*gen.ListUserIdentitiesResponse, error) {
	var pn gen.UserResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentUserName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceUsers, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	userID, err := uuid.Parse(pn.User)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentUserName}
	}

	offset, err := pagetoken.Decode(req.PageToken)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidPageToken}
	}

	pageSize := normalizePageSize(req.PageSize)

	params := repository.ListUserIdentitiesParams{
		UserID:   userID,
		Page:     int(offset/int64(pageSize)) + 1,
		PageSize: pageSize,
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.ListUserIdentitiesResponse, error) {
		repo := repository.NewFactory(tx, s.enforcer).UserIdentity()

		ms, total, err := repo.List(ctx, params)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListUserIdentities}
		}

		resp := &gen.ListUserIdentitiesResponse{TotalSize: total}
		for _, m := range ms {
			resp.Identities = append(resp.Identities, UserIdentityToProto(pn, m))
		}

		nextOffset := offset + int64(len(ms))
		if nextOffset < total {
			resp.NextPageToken = pagetoken.Encode(nextOffset)
		}

		return resp, nil
	})
}
