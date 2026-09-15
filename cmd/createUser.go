package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var (
	createUserName     string
	createUserEmail    string
	createUserPassword string
	createUserGroups   string
)

var createUserCmd = &cobra.Command{
	Use:     "user",
	Aliases: []string{"u"},
	Short:   "Create a new user",
	Long: `Create a new user with a username, email, an optional password, and
optional group assignments.

When --password is omitted the user is created without a password hash and
cannot sign in with email and password until one is set.

The --groups flag accepts a comma-separated list of group custom IDs.

Example:
  vsfv tool create user --name "jane" --email "jane@example.com" --groups "admin,editors"`,
	Run: func(cmd *cobra.Command, args []string) {
		if createUserName == "" {
			fmt.Fprintln(os.Stderr, "error: --name is required")
			os.Exit(1)
		}

		if createUserEmail == "" {
			fmt.Fprintln(os.Stderr, "error: --email is required")
			os.Exit(1)
		}

		var groupCustomIDs []string
		for _, raw := range strings.Split(createUserGroups, ",") {
			raw = strings.TrimSpace(raw)
			if raw == "" {
				continue
			}
			groupCustomIDs = append(groupCustomIDs, raw)
		}

		gormDB, err := db.ConnectSilent(config.Database.DSN)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: connecting to database: %v\n", err)
			os.Exit(1)
		}

		sqlDB, err := gormDB.DB()
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: getting underlying sql.DB: %v\n", err)
			os.Exit(1)
		}
		defer sqlDB.Close()

		ctx := context.Background()

		// Resolve groups before creating the user so an unknown custom ID
		// fails without leaving a half-provisioned user behind.
		var enforcer *authz.Enforcer
		var groups []*model.UserGroup
		if len(groupCustomIDs) > 0 {
			enforcer, err = authz.NewEnforcer(gormDB)
			if err != nil {
				fmt.Fprintf(os.Stderr, "error: creating enforcer: %v\n", err)
				os.Exit(1)
			}

			groupRepo := repository.NewUserGroupRepository(gormDB, enforcer)

			seen := make(map[string]bool, len(groupCustomIDs))
			for _, customID := range groupCustomIDs {
				group, err := groupRepo.GetByCustomID(ctx, customID)
				if err != nil {
					fmt.Fprintf(os.Stderr, "error: group not found by custom ID %q: %v\n", customID, err)
					os.Exit(1)
				}

				if seen[group.ID.String()] {
					continue
				}
				seen[group.ID.String()] = true
				groups = append(groups, group)
			}
		}

		repo := repository.NewUserRepository(gormDB)

		var user *model.User
		if createUserPassword != "" {
			user, err = repo.CreateWithPassword(ctx, repository.CreateUserWithPasswordParams{
				Email:    createUserEmail,
				Name:     createUserName,
				Password: createUserPassword,
			})
		} else {
			user, err = repo.Create(ctx, repository.CreateUserParams{
				Email: createUserEmail,
				Name:  createUserName,
			})
		}
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: creating user: %v\n", err)
			os.Exit(1)
		}

		if err := audit.NewWriter(gormDB).Record(ctx, audit.Subject{
			ResourceName: "users/" + user.ID.String(),
			ResourceID:   user.ID,
		}, audit.ActionCreate, nil, user); err != nil {
			fmt.Fprintf(os.Stderr, "error: recording audit log entry: %v\n", err)
			os.Exit(1)
		}

		if createUserPassword != "" {
			fmt.Printf("Created user %s (name: %s, email: %s, password: set)\n", user.ID, user.Name, user.Email)
		} else {
			fmt.Printf("Created user %s (name: %s, email: %s, password: not set — password login disabled)\n", user.ID, user.Name, user.Email)
		}

		if len(groups) > 0 {
			var assignedIDs []string
			for _, group := range groups {
				idStr := group.ID.String()
				if _, err := enforcer.AddGlobalGroupingPolicy(user.ID.String(), idStr); err != nil {
					fmt.Fprintf(os.Stderr, "error: assigning group %s: %v\n", group.CustomID, err)
					os.Exit(1)
				}
				assignedIDs = append(assignedIDs, idStr)
				fmt.Printf("✓ Assigned to group: %s (%s)\n", group.CustomID, idStr)
			}

			if err := enforcer.Flush(); err != nil {
				fmt.Fprintf(os.Stderr, "error: flushing enforcer: %v\n", err)
				os.Exit(1)
			}

			joined := strings.Join(assignedIDs, ",")
			if err := audit.NewWriter(gormDB).RecordChanges(ctx, audit.Subject{
				ResourceName: "users/" + user.ID.String(),
				ResourceID:   user.ID,
			}, audit.ActionUpdate, []model.AuditLogEntryChange{
				{Field: "groups", NewValue: &joined},
			}); err != nil {
				fmt.Fprintf(os.Stderr, "error: recording audit log entry: %v\n", err)
				os.Exit(1)
			}
		}
	},
}

func init() {
	createUserCmd.Flags().StringVar(&createUserName, "name", "", "Username of the user (required)")
	createUserCmd.Flags().StringVar(&createUserEmail, "email", "", "Email address of the user (required)")
	createUserCmd.Flags().StringVar(&createUserPassword, "password", "", "Optional password; if omitted the user cannot sign in with a password")
	createUserCmd.Flags().StringVar(&createUserGroups, "groups", "", "Comma-separated list of group custom IDs to assign the user to")

	createCmd.AddCommand(createUserCmd)
}
