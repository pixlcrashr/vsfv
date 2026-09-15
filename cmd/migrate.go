package cmd

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/dialect"
)

var migrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "Manage database migrations",
	Long:  `Run, rollback, or inspect database schema migrations.`,
}

var migrateUpCmd = &cobra.Command{
	Use:   "up",
	Short: "Apply all pending migrations",
	Long:  `Apply all pending database migrations to bring the schema up to date.`,
	Run: func(cmd *cobra.Command, args []string) {
		sqlDB := mustOpenDB()
		defer sqlDB.Close()

		fmt.Println("Running database migrations...")
		if err := db.Run(sqlDB); err != nil {
			fmt.Fprintf(os.Stderr, "migration failed: %v\n", err)
			os.Exit(1)
		}

		printVersion(sqlDB)
		fmt.Println("Migrations completed successfully.")

		if err := seedSystemGroup(); err != nil {
			fmt.Fprintf(os.Stderr, "seeding system group failed: %v\n", err)
			os.Exit(1)
		}
	},
}

// seedSystemGroup ensures the "system" user group exists and has all
// permissions with access to every organization. It is idempotent, so
// running it after every `migrate up` only re-syncs the wildcard policy.
func seedSystemGroup() error {
	gormDB, err := db.ConnectSilent(config.Database.DSN)
	if err != nil {
		return fmt.Errorf("connecting to database: %w", err)
	}

	sqlConn, err := gormDB.DB()
	if err != nil {
		return fmt.Errorf("getting underlying sql.DB: %w", err)
	}
	defer sqlConn.Close()

	enforcer, err := authz.NewEnforcer(gormDB)
	if err != nil {
		return fmt.Errorf("creating casbin enforcer: %w", err)
	}

	if err := authz.SeedSystemGroup(context.Background(), gormDB, enforcer); err != nil {
		return err
	}

	fmt.Println("System group is available with all permissions.")
	return nil
}

var migrateDownCmd = &cobra.Command{
	Use:   "down",
	Short: "Rollback the last migration",
	Long:  `Rollback the most recently applied database migration.`,
	Run: func(cmd *cobra.Command, args []string) {
		all, _ := cmd.Flags().GetBool("all")
		sqlDB := mustOpenDB()
		defer sqlDB.Close()

		fmt.Println("Rolling back migrations...")
		var err error
		if all {
			err = db.RollbackAll(sqlDB)
		} else {
			err = db.Rollback(sqlDB)
		}
		if err != nil {
			fmt.Fprintf(os.Stderr, "rollback failed: %v\n", err)
			os.Exit(1)
		}

		printVersion(sqlDB)
		fmt.Println("Rollback completed successfully.")
	},
}

var migrateVersionCmd = &cobra.Command{
	Use:   "version",
	Short: "Show current migration version",
	Long:  `Display the current database migration version and dirty state.`,
	Run: func(cmd *cobra.Command, args []string) {
		sqlDB := mustOpenDB()
		defer sqlDB.Close()
		printVersion(sqlDB)
	},
}

var migrateForceCmd = &cobra.Command{
	Use:   "force [version]",
	Short: "Force set migration version",
	Long: `Force set the migration version without running migrations.
Useful for fixing a dirty database state after a failed migration.
Use version -1 to clear the version.`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var version int
		if _, err := fmt.Sscanf(args[0], "%d", &version); err != nil {
			fmt.Fprintf(os.Stderr, "invalid version %q: %v\n", args[0], err)
			os.Exit(1)
		}

		sqlDB := mustOpenDB()
		defer sqlDB.Close()

		if err := db.Force(sqlDB, version); err != nil {
			fmt.Fprintf(os.Stderr, "force version failed: %v\n", err)
			os.Exit(1)
		}

		printVersion(sqlDB)
		fmt.Println("Version forced successfully.")
	},
}

var migrateStepsCmd = &cobra.Command{
	Use:   "steps [n]",
	Short: "Apply n migration steps",
	Long: `Apply n migrations. Positive n applies up migrations, negative n applies down migrations.

Examples:
  vsfv migrate steps 2    (apply 2 up migrations)
  vsfv migrate steps -1   (rollback 1 migration)`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var n int
		if _, err := fmt.Sscanf(args[0], "%d", &n); err != nil {
			fmt.Fprintf(os.Stderr, "invalid step count %q: %v\n", args[0], err)
			os.Exit(1)
		}

		sqlDB := mustOpenDB()
		defer sqlDB.Close()

		fmt.Printf("Applying %d migration step(s)...\n", n)
		if err := db.Steps(sqlDB, n); err != nil {
			fmt.Fprintf(os.Stderr, "steps migration failed: %v\n", err)
			os.Exit(1)
		}

		printVersion(sqlDB)
		fmt.Println("Steps completed successfully.")
	},
}

func init() {
	rootCmd.AddCommand(migrateCmd)
	migrateCmd.AddCommand(migrateUpCmd)
	migrateCmd.AddCommand(migrateDownCmd)
	migrateCmd.AddCommand(migrateVersionCmd)
	migrateCmd.AddCommand(migrateForceCmd)
	migrateCmd.AddCommand(migrateStepsCmd)

	migrateDownCmd.Flags().Bool("all", false, "Rollback all applied migrations")
}

// mustOpenDB opens a *sql.DB using the configured DSN.
// The driver is selected based on the DSN scheme:
//   - postgres:// or postgresql:// → "postgres" driver (lib/pq)
//   - sqlite://                   → "sqlite3" driver (mattn/go-sqlite3)
func mustOpenDB() *sql.DB {
	d, connStr, err := db.ParseDialect(config.Database.DSN)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to parse DSN: %v\n", err)
		os.Exit(1)
	}
	dialect.Current = d

	var driverName string
	switch d {
	case dialect.SQLite:
		driverName = "sqlite3"
	default:
		driverName = "postgres"
	}

	sqlDB, err := sql.Open(driverName, connStr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to open database: %v\n", err)
		os.Exit(1)
	}
	return sqlDB
}

func printVersion(sqlDB *sql.DB) {
	version, dirty, err := db.Version(sqlDB)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to get migration version: %v\n", err)
		return
	}
	dirtyMark := ""
	if dirty {
		dirtyMark = " (dirty)"
	}
	fmt.Printf("Current migration version: %d%s\n", version, dirtyMark)
}
