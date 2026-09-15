package cmd

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"

	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var listGroupsCmd = &cobra.Command{
	Use:     "groups",
	Aliases: []string{"g", "gs", "group"},
	Short:   "List all user groups",
	Long:    `List all user groups with their ID, custom ID, name, system flag, and description.`,
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

		repo := repository.NewUserGroupRepository(gormDB, enforcer)
		groups, _, err := repo.List(context.Background(), repository.ListUserGroupsParams{PageSize: 1000})
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: listing groups: %v\n", err)
			os.Exit(1)
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tCUSTOM ID\tNAME\tSYSTEM\tDESCRIPTION")
		for _, g := range groups {
			system := ""
			if g.IsSystem {
				system = "yes"
			}
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", g.ID, g.CustomID, g.Name, system, g.Description)
		}
		w.Flush()

		if len(groups) == 0 {
			fmt.Println("(no groups found)")
		}
	},
}

func init() {
	listCmd.AddCommand(listGroupsCmd)
}
