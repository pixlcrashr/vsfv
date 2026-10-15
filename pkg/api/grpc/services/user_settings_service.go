package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

var (
	statusInvalidUserSettingsName  = status.New(codes.InvalidArgument, "invalid user settings name")
	statusFailedGetUserSettings    = status.New(codes.Internal, "failed to get user settings")
	statusFailedUpdateUserSettings = status.New(codes.Internal, "failed to update user settings")
	statusUserSettingsRequired     = status.New(codes.InvalidArgument, "settings is required")
)

type userSettingsServiceServer struct {
	gen.UnimplementedUserSettingsServiceServer
	db       *gorm.DB
	enforcer *authz.Enforcer
}

func newUserSettingsServiceServer(db *gorm.DB, enforcer *authz.Enforcer) gen.UserSettingsServiceServer {
	return &userSettingsServiceServer{db: db, enforcer: enforcer}
}

func (s *userSettingsServiceServer) GetUserSettings(ctx context.Context, req *gen.GetUserSettingsRequest) (*gen.UserSettings, error) {
	var n gen.UserSettingsResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidUserSettingsName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceSettings, authz.ActionRead); err != nil {
		return nil, authError(err)
	}

	userID, err := uuid.Parse(n.User)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidUserSettingsName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.UserSettings, error) {
		repo := repository.NewFactory(tx, s.enforcer).UserSettings()

		m, err := repo.GetByUserID(ctx, userID)
		if err != nil {
			if errors.Is(err, repository.ErrUserSettingsNotFound) {
				// Return empty defaults when no settings row exists yet.
				return &gen.UserSettings{
					Name:               gen.UserSettingsResourceName{User: n.User}.String(),
					Locale:             "",
					Theme:              "system",
					EmailNotifications: false,
				}, nil
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetUserSettings}
		}

		return UserSettingsToProto(n.UserResourceName(), m), nil
	})
}

func (s *userSettingsServiceServer) UpdateUserSettings(ctx context.Context, req *gen.UpdateUserSettingsRequest) (*gen.UserSettings, error) {
	if req.Settings == nil {
		return nil, &ServerError{Status: statusUserSettingsRequired}
	}

	var n gen.UserSettingsResourceName
	if err := n.UnmarshalString(req.Settings.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidUserSettingsName}
	}

	if err := authz.CheckGlobal(ctx, s.enforcer, authz.ResourceSettings, authz.ActionUpdate); err != nil {
		return nil, authError(err)
	}

	userID, err := uuid.Parse(n.User)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidUserSettingsName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.UserSettings, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.UserSettings()
		audits := newAuditWriter(tx)

		// Upsert may create the settings row; distinguish the two audit actions.
		before, err := repo.GetByUserID(ctx, userID)
		if err != nil && !errors.Is(err, repository.ErrUserSettingsNotFound) {
			return nil, &ServerError{Err: err, Status: statusFailedGetUserSettings}
		}

		m, err := repo.Upsert(ctx, userID, req.Settings.Locale, req.Settings.Theme, req.Settings.EmailNotifications)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedUpdateUserSettings}
		}

		subject := auditSubject{
			ResourceName: gen.UserSettingsResourceName{User: n.User}.String(),
			ResourceID:   m.ID,
		}
		var action string
		var beforeAny any
		if before == nil {
			action, beforeAny = AuditActionCreate, nil
		} else {
			action, beforeAny = AuditActionUpdate, before
		}
		if err := audits.Record(ctx, subject, action, beforeAny, m); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return UserSettingsToProto(n.UserResourceName(), m), nil
	})
}
