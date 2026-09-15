package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/spf13/cobra"

	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var listUsersCmd = &cobra.Command{
	Use:     "users",
	Aliases: []string{"u", "us", "user"},
	Short:   "List all users",
	Long:    `List all users with their ID, email, name, and group assignments.`,
	Run: func(cmd *cobra.Command, args []string) {
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

		repo := repository.NewUserRepository(gormDB)
		users, _, err := repo.List(context.Background(), repository.ListUsersParams{PageSize: 1000})
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: listing users: %v\n", err)
			os.Exit(1)
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tEMAIL\tNAME\tGROUPS")
		for _, u := range users {
			roles, err := enforcer.GetGlobalRolesForUser(u.ID.String())
			if err != nil {
				fmt.Fprintf(os.Stderr, "error: getting groups for user %s: %v\n", u.ID, err)
				os.Exit(1)
			}
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", u.ID, u.Email, u.Name, joinNonEmpty(roles, ", "))
		}
		w.Flush()

		if len(users) == 0 {
			fmt.Println("(no users found)")
		}
	},
}

func joinNonEmpty(ss []string, sep string) string {
	if len(ss) == 0 {
		return "-"
	}
	var parts []string
	for _, s := range ss {
		if s != "" {
			parts = append(parts, s)
		}
	}
	if len(parts) == 0 {
		return "-"
	}
	return strings.Join(parts, sep)
}

func init() {
	listCmd.AddCommand(listUsersCmd)
}
