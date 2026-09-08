package cmd

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/spf13/cobra"

	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var (
	createOrganizationName        string
	createOrganizationDescription string
	createOrganizationStartMonth  int
	createOrganizationCustomID    string
)

var createOrganizationCmd = &cobra.Command{
	Use:   "organization",
	Short: "Create a new organization",
	Long: `Create a new organization with a display name, optional description,
fiscal-year start month, and optional custom ID.`,
	Run: func(cmd *cobra.Command, args []string) {
		if createOrganizationName == "" {
			fmt.Fprintln(os.Stderr, "error: --name is required")
			os.Exit(1)
		}

		if createOrganizationStartMonth < 1 || createOrganizationStartMonth > 12 {
			fmt.Fprintln(os.Stderr, "error: --start-month must be between 1 and 12")
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

		repo := repository.NewOrganizationRepository(gormDB)
		org, err := repo.Create(context.Background(), repository.CreateOrganizationParams{
			DisplayName:        createOrganizationName,
			DisplayDescription: createOrganizationDescription,
			StartMonth:         time.Month(createOrganizationStartMonth),
			CustomID:           createOrganizationCustomID,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: creating organization: %v\n", err)
			os.Exit(1)
		}

		if err := audit.NewWriter(gormDB).Record(context.Background(), audit.Subject{
			ResourceName: "organizations/" + org.CustomID,
			ResourceID:   org.ID,
		}, audit.ActionCreate, nil, org); err != nil {
			fmt.Fprintf(os.Stderr, "error: recording audit log entry: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Created organization %s (custom ID: %s, name: %s)\n", org.ID, org.CustomID, org.DisplayName)
	},
}

func init() {
	createOrganizationCmd.Flags().StringVar(&createOrganizationName, "name", "", "Display name of the organization")
	createOrganizationCmd.Flags().StringVar(&createOrganizationDescription, "description", "", "Optional description")
	createOrganizationCmd.Flags().IntVar(&createOrganizationStartMonth, "start-month", 1, "Fiscal year start month (1-12)")
	createOrganizationCmd.Flags().StringVar(&createOrganizationCustomID, "custom-id", "", "Optional custom identifier")

	_ = createOrganizationCmd.RegisterFlagCompletionFunc("start-month", func(_ *cobra.Command, _ []string, _ string) ([]string, cobra.ShellCompDirective) {
		months := make([]string, 12)
		for i := 1; i <= 12; i++ {
			months[i-1] = strconv.Itoa(i)
		}
		return months, cobra.ShellCompDirectiveDefault
	})

	createCmd.AddCommand(createOrganizationCmd)
}
