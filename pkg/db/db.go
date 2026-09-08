package db

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/pixlcrashr/vsfv/pkg/db/dialect"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ParseDialect detects the database provider from the DSN URL scheme.
// Supported schemes: postgres://, postgresql://, sqlite://
func ParseDialect(dsn string) (dialect.Dialect, string, error) {
	u, err := url.Parse(dsn)
	if err != nil {
		return "", dsn, fmt.Errorf("invalid DSN: %w", err)
	}

	scheme := strings.ToLower(u.Scheme)
	switch scheme {
	case "postgres", "postgresql":
		return dialect.PostgreSQL, dsn, nil
	case "sqlite":
		// Strip the scheme and pass the path to the SQLite driver.
		// e.g. sqlite://db.sqlite -> db.sqlite
		path := strings.TrimPrefix(dsn, "sqlite://")
		return dialect.SQLite, path, nil
	default:
		return "", dsn, fmt.Errorf("unsupported database scheme %q (expected postgres:// or sqlite://)", scheme)
	}
}

func Connect(dsn string) (*gorm.DB, error) {
	d, connStr, err := ParseDialect(dsn)
	if err != nil {
		return nil, err
	}
	dialect.Current = d

	var dialector gorm.Dialector
	switch d {
	case dialect.PostgreSQL:
		dialector = postgres.Open(connStr)
	case dialect.SQLite:
		dialector = sqlite.Open(connStr)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	return db, nil
}

func ConnectSilent(dsn string) (*gorm.DB, error) {
	d, connStr, err := ParseDialect(dsn)
	if err != nil {
		return nil, err
	}
	dialect.Current = d

	var dialector gorm.Dialector
	switch d {
	case dialect.PostgreSQL:
		dialector = postgres.Open(connStr)
	case dialect.SQLite:
		dialector = sqlite.Open(connStr)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	return db, nil
}

var Models = []any{
	&model.AccountGroupAssignment{},
	&model.AccountGroup{},
	&model.Account{},
	&model.AuditLogEntry{},
	&model.BudgetRevisionAccountValue{},
	&model.BudgetRevision{},
	&model.BudgetAccountValue{},
	&model.Budget{},
	&model.LedgerYear{},
	&model.LedgerAccount{},
	&model.Organization{},
	&model.Transaction_{},
	&model.TransactionAssignment{},
	&model.ReportTemplate{},
	&model.Report{},
	&model.User{},
	&model.UserIdentity{},
	&model.UserSettings{},
	&model.UserGroup{},
	&model.CasbinRule{},
	&model.OAuth2Client{},
	&model.OAuth2Token{},
	&model.AuthSession{},
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(Models...)
}
