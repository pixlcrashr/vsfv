package grpc_test

import (
	"context"
	"database/sql"
	"net"
	"testing"

	"github.com/pixlcrashr/vsfv/pkg/db/model"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"
	"gorm.io/gorm/logger"

	googlegrpc "google.golang.org/grpc"

	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	pkgdb "github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"gorm.io/gorm"

	_ "github.com/lib/pq"
)

const (
	bufSize = 1024 * 1024
	testDSN = "postgres://vsf:postgres@127.0.0.1:5335/vsf?sslmode=disable"
)

var (
	lis                              *bufconn.Listener
	conn                             *grpc.ClientConn
	gormDB                           *gorm.DB
	LedgerAccountRepo                *repository.LedgerAccountRepository
	TransactionAssignmentRepo        *repository.TransactionAssignmentRepository
	OrgClient                        gen.OrganizationServiceClient
	AccountClient                    gen.AccountServiceClient
	BudgetClient                     gen.BudgetServiceClient
	BudgetRevisionClient             gen.BudgetRevisionServiceClient
	BudgetRevisionAccountValueClient gen.BudgetRevisionAccountValueServiceClient
	BudgetAccountValueClient         gen.BudgetAccountValueServiceClient
	BudgetActualAccountValueClient   gen.BudgetActualAccountValueServiceClient
	LedgerAccountClient              gen.LedgerAccountServiceClient
	LedgerYearClient                 gen.LedgerYearServiceClient
	TransactionAssignmentClient      gen.TransactionAssignmentServiceClient
	TransactionClient                gen.TransactionServiceClient
)

func TestGrpc(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Grpc Suite")
}

var _ = BeforeSuite(func() {
	sqlDB, err := sql.Open("postgres", testDSN)
	Expect(err).NotTo(HaveOccurred())
	defer sqlDB.Close()

	By("resetting the test DB schema")
	_, err = sqlDB.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
	Expect(err).NotTo(HaveOccurred())

	By("applying all migrations on the clean schema")
	err = pkgdb.Run(sqlDB)
	Expect(err).NotTo(HaveOccurred())

	var err2 error
	gormDB, err2 = pkgdb.Connect(testDSN)
	gormDB.Logger = gormDB.Logger.LogMode(logger.Silent)
	Expect(err2).NotTo(HaveOccurred())

	enforcer, err := authz.NewEnforcer(gormDB)
	Expect(err).NotTo(HaveOccurred())

	// Seed the admin system group and bind a fixed test user to it so the
	// enforcer authorizes every request (the bufconn server bypasses the
	// HTTP auth middleware that would normally inject the user).
	const testUserID = "00000000-0000-0000-0000-0000000000a1"
	Expect(authz.SeedAdminGroup(context.Background(), gormDB, enforcer)).NotTo(HaveOccurred())
	var adminGroup model.UserGroup
	Expect(gormDB.Where("custom_id = ?", authz.AdminGroupCustomID).First(&adminGroup).Error).NotTo(HaveOccurred())
	Expect(enforcer.AddGlobalGroupingPolicy(testUserID, adminGroup.ID.String())).To(BeTrue())
	testCtx := authz.WithUser(context.Background(), testUserID, authz.AllAPIScopes)

	svc := services.New(gormDB, enforcer, nil, false)

	lis = bufconn.Listen(bufSize)
	s := googlegrpc.NewServer(
		googlegrpc.UnaryInterceptor(func(
			ctx context.Context,
			req interface{},
			_ *googlegrpc.UnaryServerInfo,
			handler googlegrpc.UnaryHandler,
		) (interface{}, error) {
			return handler(testCtx, req)
		}),
	)
	gen.RegisterOrganizationServiceServer(s, svc.Organization)
	gen.RegisterAccountServiceServer(s, svc.Account)
	gen.RegisterBudgetServiceServer(s, svc.Budget)
	gen.RegisterBudgetRevisionServiceServer(s, svc.BudgetRevision)
	gen.RegisterBudgetRevisionAccountValueServiceServer(s, svc.BudgetRevisionAccountValue)
	gen.RegisterBudgetAccountValueServiceServer(s, svc.BudgetAccountValue)
	gen.RegisterBudgetActualAccountValueServiceServer(s, svc.BudgetActualAccountValue)
	gen.RegisterLedgerYearServiceServer(s, svc.LedgerYear)
	gen.RegisterLedgerAccountServiceServer(s, svc.LedgerAccount)
	gen.RegisterTransactionServiceServer(s, svc.Transaction)
	gen.RegisterTransactionAssignmentServiceServer(s, svc.TransactionAssignment)
	go func() { _ = s.Serve(lis) }()

	conn, err = grpc.NewClient(
		"passthrough:///bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	Expect(err).NotTo(HaveOccurred())

	LedgerAccountRepo = repository.NewLedgerAccountRepository(gormDB)
	TransactionAssignmentRepo = repository.NewTransactionAssignmentRepository(gormDB)

	OrgClient = gen.NewOrganizationServiceClient(conn)
	AccountClient = gen.NewAccountServiceClient(conn)
	BudgetClient = gen.NewBudgetServiceClient(conn)
	BudgetRevisionClient = gen.NewBudgetRevisionServiceClient(conn)
	BudgetRevisionAccountValueClient = gen.NewBudgetRevisionAccountValueServiceClient(conn)
	BudgetAccountValueClient = gen.NewBudgetAccountValueServiceClient(conn)
	BudgetActualAccountValueClient = gen.NewBudgetActualAccountValueServiceClient(conn)
	LedgerAccountClient = gen.NewLedgerAccountServiceClient(conn)
	LedgerYearClient = gen.NewLedgerYearServiceClient(conn)
	TransactionAssignmentClient = gen.NewTransactionAssignmentServiceClient(conn)
	TransactionClient = gen.NewTransactionServiceClient(conn)

	DeferCleanup(func() {
		_ = conn.Close()
		_ = lis.Close()
		s.GracefulStop()
	})
})
