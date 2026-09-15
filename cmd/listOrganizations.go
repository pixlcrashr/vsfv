package cmd

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/spf13/cobra"

	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var listOrganizationsCmd = &cobra.Command{
	Use:     "organizations",
	Aliases: []string{"o", "os", "organization"},
	Short:   "List all organizations",
	Long:    `List all organizations with their ID, custom ID, and display name.`,
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

		repo := repository.NewOrganizationRepository(gormDB)
		orgs, _, err := repo.List(context.Background(), repository.ListOrganizationsParams{PageSize: 1000})
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: listing organizations: %v\n", err)
			os.Exit(1)
		}

		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tCUSTOM ID\tDISPLAY NAME")
		for _, o := range orgs {
			fmt.Fprintf(w, "%s\t%s\t%s\n", o.ID, o.CustomID, o.DisplayName)
		}
		w.Flush()

		if len(orgs) == 0 {
			fmt.Println("(no organizations found)")
		}
	},
}

func init() {
	listCmd.AddCommand(listOrganizationsCmd)
}
