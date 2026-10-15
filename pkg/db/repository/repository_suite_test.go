package repository_test

import (
	"database/sql"
	"fmt"
	"os"
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"gorm.io/gorm"

	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var (
	dbConn *gorm.DB
	sqlDB  *sql.DB

	// dbPath is the path of the throwaway SQLite database file that is
	// removed again when the suite finishes.
	dbPath string

	// Repositories
	BudgetActualAccountValueRepo *repository.BudgetActualAccountValueRepository
	BudgetRepo                   *repository.BudgetRepository
	OrganizationRepo             *repository.OrganizationRepository
	AccountRepo                  *repository.AccountRepository
	TransactionRepo              *repository.TransactionRepository
	LedgerAccountRepo            *repository.LedgerAccountRepository
	LedgerYearRepo               *repository.LedgerYearRepository
	BudgetAccountValueRepo       *repository.BudgetAccountValueRepository
	TransactionAssignmentRepo    *repository.TransactionAssignmentRepository
	DataItemRepo                 *repository.DataItemRepository
	SubmissionRepo               *repository.SubmissionRepository
)

func TestRepository(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Repository Suite")
}

// resetSchema drops every table and re-applies all migrations. The gorm and
// database/sql handles stay valid, so repositories created during
// BeforeSuite keep working across specs.
func resetSchema() {
	By("resetting the test DB schema")
	var tables []string
	Expect(dbConn.Raw(
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
	).Scan(&tables).Error).NotTo(HaveOccurred())
	for _, table := range tables {
		Expect(dbConn.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %q", table)).Error).NotTo(HaveOccurred())
	}

	By("applying all migrations on the clean schema")
	Expect(db.Run(sqlDB)).To(Succeed())
}

var _ = BeforeSuite(func() {
	By("creating a clean throwaway SQLite database")
	f, err := os.CreateTemp("", "vsfv-repository-test-*.sqlite")
	Expect(err).NotTo(HaveOccurred())
	Expect(f.Close()).To(Succeed())
	dbPath = f.Name()
	DeferCleanup(func() {
		_ = os.Remove(dbPath)
	})

	By("connecting with GORM")
	dbConn, err = db.ConnectSilent("sqlite://" + dbPath)
	Expect(err).NotTo(HaveOccurred())
	sqlDB, err = dbConn.DB()
	Expect(err).NotTo(HaveOccurred())
	DeferCleanup(func() {
		_ = sqlDB.Close()
	})

	resetSchema()

	By("initializing repositories")
	BudgetActualAccountValueRepo = repository.NewBudgetActualAccountValueRepository(dbConn)
	BudgetRepo = repository.NewBudgetRepository(dbConn)
	OrganizationRepo = repository.NewOrganizationRepository(dbConn)
	AccountRepo = repository.NewAccountRepository(dbConn)
	TransactionRepo = repository.NewTransactionRepository(dbConn)
	LedgerAccountRepo = repository.NewLedgerAccountRepository(dbConn)
	LedgerYearRepo = repository.NewLedgerYearRepository(dbConn)
	BudgetAccountValueRepo = repository.NewBudgetAccountValueRepository(dbConn)
	TransactionAssignmentRepo = repository.NewTransactionAssignmentRepository(dbConn)
	DataItemRepo = repository.NewDataItemRepository(dbConn)
	SubmissionRepo = repository.NewSubmissionRepository(dbConn)
})

var _ = BeforeEach(func() {
	// Reset schema for each test to ensure completely isolated state
	resetSchema()
})
