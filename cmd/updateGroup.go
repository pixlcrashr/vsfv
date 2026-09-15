package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
	"github.com/theater-improrama/go-utils/optional"

	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var updateGroupOrganizations string
var updateGroupForce bool

var updateGroupCmd = &cobra.Command{
	Use:     "group <uuid|customID>",
	Aliases: []string{"g <uuid|customID>"},
	Short:   "Update an existing group",
	Long: `Update an existing group's organization assignments.

The --organizations flag accepts a comma-separated list of organization UUIDs or
custom IDs, or "*" to assign the group to all organizations (wildcard).
Specifying --organizations replaces the group's current organization assignments
entirely.

Examples:
  vsfv tool update group 550e8400-e29b-41d4-a716-446655440000 --organizations "org1,org2"
  vsfv tool update group admin --organizations "*"
  vsfv tool update group editors --organizations "org1,550e8400-e29b-41d4-a716-446655440000"`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		if updateGroupOrganizations == "" {
			fmt.Fprintln(os.Stderr, "error: --organizations must be provided")
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
		groupRepo := repository.NewUserGroupRepository(gormDB, enforcer)
		orgRepo := repository.NewOrganizationRepository(gormDB)

		// Resolve group identifier (UUID or custom ID).
		var groupID uuid.UUID
		if id, err := uuid.Parse(args[0]); err == nil {
			group, err := groupRepo.GetByID(ctx, id)
			if err != nil {
				fmt.Fprintf(os.Stderr, "error: group not found by UUID %s: %v\n", args[0], err)
				os.Exit(1)
			}
			groupID = group.ID
		} else {
			group, err := groupRepo.GetByCustomID(ctx, args[0])
			if err != nil {
				fmt.Fprintf(os.Stderr, "error: group not found by custom ID %q: %v\n", args[0], err)
				os.Exit(1)
			}
			groupID = group.ID
		}

		// Parse organization identifiers and build resource names.
		var orgResourceNames []string
		for _, raw := range strings.Split(updateGroupOrganizations, ",") {
			raw = strings.TrimSpace(raw)
			if raw == "" {
				continue
			}

			// Wildcard: assign to all organizations.
			if raw == authz.WildcardDomain {
				orgResourceNames = []string{authz.WildcardDomain}
				break
			}

			// Resolve org identifier (UUID or custom ID) to the org's custom ID,
			// then build the resource name "organizations/{customID}".
			org, err := orgRepo.GetByResourceName(ctx, raw)
			if err != nil {
				fmt.Fprintf(os.Stderr, "error: organization not found %q: %v\n", raw, err)
				os.Exit(1)
			}
			orgResourceNames = append(orgResourceNames, "organizations/"+org.CustomID)
		}

		if len(orgResourceNames) == 0 {
			fmt.Fprintln(os.Stderr, "error: no valid organizations provided")
			os.Exit(1)
		}

		// Update the group's organization assignments.
		err = groupRepo.Update(ctx, groupID, repository.UpdateUserGroupParams{
			Organizations: optional.From(orgResourceNames),
			ForceSystem:   updateGroupForce,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: updating group organizations: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("✓ Updated organizations for group %s: %s\n", groupID, strings.Join(orgResourceNames, ", "))
	},
}

func init() {
	updateCmd.AddCommand(updateGroupCmd)

	updateGroupCmd.Flags().StringVar(&updateGroupOrganizations, "organizations", "", "Comma-separated list of organization UUIDs or custom IDs, or \"*\" for all (replaces current assignments)")
	updateGroupCmd.Flags().BoolVarP(&updateGroupForce, "force", "f", false, "Allow modifying system groups")
}
