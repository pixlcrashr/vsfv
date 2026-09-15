package cmd

import (
	"fmt"
	"os"

	"github.com/google/uuid"
	"github.com/spf13/cobra"

	"github.com/pixlcrashr/vsfv/pkg/api/importexport/xmlformat"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var exportXMLCmd = &cobra.Command{
	Use:   "export-xml <organization_id> <output.xml>",
	Short: "Export organization data to XML",
	Long: `Export a single organization into the XML import/export format: the
organization record itself plus its accounts, account groups, ledger
accounts/years, budgets, revisions and transactions, all nested inside one
<organization> element. The format supports multiple organizations per file in
theory, but exactly one is exported.`,
	Args: cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		orgID, err := uuid.Parse(args[0])
		if err != nil {
			return fmt.Errorf("invalid organization_id: %w", err)
		}

		gormDB, err := db.Connect(config.Database.DSN)
		if err != nil {
			return fmt.Errorf("connecting to database: %w", err)
		}

		deps := &xmlformat.ExportRepositoryDependencies{
			OrganizationRepo:               repository.NewOrganizationRepository(gormDB),
			AccountRepo:                    repository.NewAccountRepository(gormDB),
			AccountGroupRepo:               repository.NewAccountGroupRepository(gormDB),
			AccountGroupAssignmentRepo:     repository.NewAccountGroupAssignmentRepository(gormDB),
			BudgetRepo:                     repository.NewBudgetRepository(gormDB),
			BudgetAccountValueRepo:         repository.NewBudgetAccountValueRepository(gormDB),
			BudgetRevisionRepo:             repository.NewBudgetRevisionRepository(gormDB),
			BudgetRevisionAccountValueRepo: repository.NewBudgetRevisionAccountValueRepository(gormDB),
			LedgerAccountRepo:              repository.NewLedgerAccountRepository(gormDB),
			LedgerYearRepo:                 repository.NewLedgerYearRepository(gormDB),
			TransactionRepo:                repository.NewTransactionRepository(gormDB),
			TransactionAssignmentRepo:      repository.NewTransactionAssignmentRepository(gormDB),
		}

		doc, err := xmlformat.ExportOrganization(cmd.Context(), deps, orgID)
		if err != nil {
			return fmt.Errorf("export failed: %w", err)
		}

		data, err := xmlformat.Marshal(doc)
		if err != nil {
			return fmt.Errorf("marshal xml: %w", err)
		}

		if err := os.WriteFile(args[1], data, 0o644); err != nil {
			return fmt.Errorf("write file: %w", err)
		}

		fmt.Printf("Exported organization %s to %s\n", orgID, args[1])
		return nil
	},
}

func init() {
	rootCmd.AddCommand(exportXMLCmd)
}
