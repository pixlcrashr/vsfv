package cmd

import (
	"fmt"
	"os"

	"github.com/google/uuid"
	"github.com/spf13/cobra"

	"github.com/pixlcrashr/vsfv/pkg/api/importexport/xmlformat"
	"github.com/pixlcrashr/vsfv/pkg/db"
)

var importXMLCmd = &cobra.Command{
	Use:   "import-xml <organization_id> <input.xml>",
	Short: "Import organization data from XML",
	Long: `Import an XML file containing exactly one organization (the format
supports more in theory, but only one per file is currently supported) into the
given target organization. The organization record is restored from the
document (and created if the target does not exist yet); users and groups are
never restored. The import is performed in one database transaction: either all
data is imported or none is, and every change is recorded in the audit log.`,
	Args: cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		orgID, err := uuid.Parse(args[0])
		if err != nil {
			return fmt.Errorf("invalid organization_id: %w", err)
		}

		data, err := os.ReadFile(args[1])
		if err != nil {
			return fmt.Errorf("read file: %w", err)
		}

		doc, err := xmlformat.Unmarshal(data)
		if err != nil {
			return fmt.Errorf("parse xml: %w", err)
		}

		gormDB, err := db.Connect(config.Database.DSN)
		if err != nil {
			return fmt.Errorf("connecting to database: %w", err)
		}

		if err := xmlformat.ImportDocument(cmd.Context(), gormDB, orgID, doc); err != nil {
			return fmt.Errorf("import failed: %w", err)
		}

		fmt.Printf("Imported %s into organization %s\n", args[1], orgID)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(importXMLCmd)
}
