package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/spf13/cobra"

	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var (
	updateUserEmail  string
	updateUserName   string
	updateUserGroups string
)

var updateUserCmd = &cobra.Command{
	Use:   "user <uuid>",
	Short: "Update an existing user",
	Long: `Update an existing user's email, name, and/or group assignments.

The --groups flag accepts a comma-separated list of group UUIDs or custom IDs.
Specifying --groups replaces the user's current group assignments entirely.

Example:
  vsfv tool update user 550e8400-e29b-41d4-a716-446655440000 --groups "admin,editors"`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		userUUID, err := uuid.Parse(args[0])
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: invalid UUID %q: %v\n", args[0], err)
			os.Exit(1)
		}

		if updateUserEmail == "" && updateUserName == "" && updateUserGroups == "" {
			fmt.Fprintln(os.Stderr, "error: at least one of --email, --name, or --groups must be provided")
			os.Exit(1)
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

		enforcer, err := authz.NewEnforcer(gormDB)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: creating enforcer: %v\n", err)
			os.Exit(1)
		}

		ctx := context.Background()
		userRepo := repository.NewUserRepository(gormDB)

		user, err := userRepo.GetByID(ctx, userUUID)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: user not found: %v\n", err)
			os.Exit(1)
		}

		// Update group assignments if --groups is provided
		if updateUserGroups != "" {
			groupRepo := repository.NewUserGroupRepository(gormDB, enforcer)

			// Parse requested group IDs
			var requestedGroupIDs []uuid.UUID
			for _, raw := range strings.Split(updateUserGroups, ",") {
				raw = strings.TrimSpace(raw)
				if raw == "" {
					continue
				}

				if id, err := uuid.Parse(raw); err == nil {
					group, err := groupRepo.GetByID(ctx, id)
					if err != nil {
						fmt.Fprintf(os.Stderr, "error: group not found by UUID %s: %v\n", raw, err)
						os.Exit(1)
					}
					requestedGroupIDs = append(requestedGroupIDs, group.ID)
				} else {
					group, err := groupRepo.GetByCustomID(ctx, raw)
					if err != nil {
						fmt.Fprintf(os.Stderr, "error: group not found by custom ID %q: %v\n", raw, err)
						os.Exit(1)
					}
					requestedGroupIDs = append(requestedGroupIDs, group.ID)
				}
			}

			// Get current group assignments
			currentRoles, err := enforcer.GetGlobalRolesForUser(user.ID.String())
			if err != nil {
				fmt.Fprintf(os.Stderr, "error: getting current groups: %v\n", err)
				os.Exit(1)
			}

			currentSet := make(map[string]bool, len(currentRoles))
			for _, r := range currentRoles {
				currentSet[r] = true
			}

			requestedSet := make(map[string]bool, len(requestedGroupIDs))
			for _, id := range requestedGroupIDs {
				requestedSet[id.String()] = true
			}

			// Remove groups no longer assigned
			for _, role := range currentRoles {
				if !requestedSet[role] {
					if _, err := enforcer.RemoveGlobalGroupingPolicy(user.ID.String(), role); err != nil {
						fmt.Fprintf(os.Stderr, "error: removing group %s: %v\n", role, err)
						os.Exit(1)
					}
					fmt.Printf("✓ Removed from group: %s\n", role)
				}
			}

			// Add new groups
			for _, id := range requestedGroupIDs {
				idStr := id.String()
				if !currentSet[idStr] {
					if _, err := enforcer.AddGlobalGroupingPolicy(user.ID.String(), idStr); err != nil {
						fmt.Fprintf(os.Stderr, "error: assigning group %s: %v\n", idStr, err)
						os.Exit(1)
					}
					fmt.Printf("✓ Assigned to group: %s\n", idStr)
				}
			}

			if err := enforcer.Flush(); err != nil {
				fmt.Fprintf(os.Stderr, "error: flushing enforcer: %v\n", err)
				os.Exit(1)
			}

			// Audit the membership change (stored in casbin only).
			join := func(ids []string) *string {
				if len(ids) == 0 {
					return nil
				}
				joined := strings.Join(ids, ",")
				return &joined
			}
			newRoles := make([]string, 0, len(requestedGroupIDs))
			for _, id := range requestedGroupIDs {
				newRoles = append(newRoles, id.String())
			}
			if err := audit.NewWriter(gormDB).RecordChanges(ctx, audit.Subject{
				ResourceName: "users/" + user.ID.String(),
				ResourceID:   user.ID,
			}, audit.ActionUpdate, []model.AuditLogEntryChange{
				{Field: "groups", OldValue: join(currentRoles), NewValue: join(newRoles)},
			}); err != nil {
				fmt.Fprintf(os.Stderr, "error: recording audit log entry: %v\n", err)
				os.Exit(1)
			}
		}
	},
}

func init() {
	updateCmd.AddCommand(updateUserCmd)

	updateUserCmd.Flags().StringVar(&updateUserGroups, "groups", "", "Comma-separated list of group UUIDs or custom IDs (replaces current assignments)")
}
