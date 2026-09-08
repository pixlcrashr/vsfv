package adduser

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	"gorm.io/gorm"
)

type CreateUserParams struct {
	Email    string
	Name     string
	Password string
	GroupID  *uuid.UUID
}

type Result struct {
	UserID  uuid.UUID
	GroupID *uuid.UUID
}

// Create creates a user with a password and optionally assigns the user to a
// group. The entire operation runs in a single database transaction — if any
// step fails, all changes are rolled back.
func Create(ctx context.Context, db *gorm.DB, enforcer *authz.Enforcer, params CreateUserParams) (*Result, error) {
	if params.Email == "" {
		return nil, fmt.Errorf("email is required")
	}
	if params.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if params.Password == "" {
		return nil, fmt.Errorf("password is required")
	}

	var result *Result

	err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		userRepo := repository.NewUserRepository(tx)
		user, err := userRepo.CreateWithPassword(ctx, repository.CreateUserWithPasswordParams{
			Email:    params.Email,
			Name:     params.Name,
			Password: params.Password,
		})
		if err != nil {
			return fmt.Errorf("create user: %w", err)
		}

		// The audit write joins the transaction so a rollback also removes
		// the audit entry.
		if err := audit.NewWriter(tx).Record(ctx, audit.Subject{
			ResourceName: "users/" + user.ID.String(),
			ResourceID:   user.ID,
		}, audit.ActionCreate, nil, user); err != nil {
			return fmt.Errorf("record audit log entry: %w", err)
		}

		result = &Result{
			UserID: user.ID,
		}

		if params.GroupID != nil && *params.GroupID != uuid.Nil {
			groupRepo := repository.NewUserGroupRepository(tx, enforcer)
			group, err := groupRepo.GetByID(ctx, *params.GroupID)
			if err != nil {
				return fmt.Errorf("get group %s: %w", params.GroupID, err)
			}

			if _, err := enforcer.AddGlobalGroupingPolicy(user.ID.String(), group.ID.String()); err != nil {
				return fmt.Errorf("assign user to group %s: %w", group.ID, err)
			}

			if err := enforcer.Flush(); err != nil {
				return fmt.Errorf("flush enforcer after group assignment: %w", err)
			}

			result.GroupID = &group.ID
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}
