package grpc_test

import (
	"context"
	"flag"
	"net"
	"os"
	"testing"

	"github.com/pixlcrashr/vsfv/pkg/db/model"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"

	googlegrpc "google.golang.org/grpc"

	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/cfg"
	pkgdb "github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"gorm.io/gorm"
)

const bufSize = 1024 * 1024

// configFile mirrors the -c/--config flag of the other programs (go test's own
// -c flag is taken, so it is named -config and passed via
// `go test ./test/grpc/ -args -config=<path>`).
var configFile = flag.String("config", "", "config file (default: ./config.yaml)")

var (
	lis                              *bufconn.Listener
	conn                             *grpc.ClientConn
	gormDB                           *gorm.DB
	enforcer                         *authz.Enforcer
	testCtx                          context.Context
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
	UserClient                       gen.UserServiceClient
	CommitteeClient                  gen.CommitteeServiceClient
	SubmissionClient                 gen.SubmissionServiceClient
	SubmissionItemClient             gen.SubmissionItemServiceClient
)

func TestGrpc(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Grpc Suite")
}

var _ = BeforeSuite(func() {
	By("loading configuration")
	// The configuration is loaded like in the other programs (which also
	// validates the -config file when one is given), but the tests always run
	// against a clean throwaway SQLite database so they can never touch a
	// database configured in the config file.
	_, err := cfg.Load(*configFile)
	Expect(err).NotTo(HaveOccurred())

	By("creating a clean throwaway SQLite database")
	f, err := os.CreateTemp("", "vsfv-grpc-test-*.sqlite")
	Expect(err).NotTo(HaveOccurred())
	Expect(f.Close()).To(Succeed())
	DeferCleanup(func() {
		_ = os.Remove(f.Name())
	})

	gormDB, err = pkgdb.ConnectSilent("sqlite://" + f.Name())
	Expect(err).NotTo(HaveOccurred())
	sqlDB, err := gormDB.DB()
	Expect(err).NotTo(HaveOccurred())
	DeferCleanup(func() {
		_ = sqlDB.Close()
	})

	By("applying all migrations on the clean schema")
	Expect(pkgdb.Run(sqlDB)).To(Succeed())

	enforcer, err = authz.NewEnforcer(gormDB)
	Expect(err).NotTo(HaveOccurred())

	// Seed the admin system group and bind a fixed test user to it so the
	// enforcer authorizes every request (the bufconn server bypasses the
	// HTTP auth middleware that would normally inject the user).
	const testUserID = "00000000-0000-0000-0000-0000000000a1"
	Expect(authz.SeedAdminGroup(context.Background(), gormDB, enforcer)).NotTo(HaveOccurred())
	var adminGroup model.UserGroup
	Expect(gormDB.Where("custom_id = ?", authz.AdminGroupCustomID).First(&adminGroup).Error).NotTo(HaveOccurred())
	Expect(enforcer.AddGlobalGroupingPolicy(testUserID, adminGroup.ID.String())).To(BeTrue())
	testCtx = authz.WithUser(context.Background(), testUserID, authz.AllAPIScopes)

	svc := services.New(gormDB, enforcer, nil, false)

	lis = bufconn.Listen(bufSize)
	s := googlegrpc.NewServer(
		googlegrpc.UnaryInterceptor(func(
			ctx context.Context,
			req interface{},
			_ *googlegrpc.UnaryServerInfo,
			handler googlegrpc.UnaryHandler,
		) (interface{}, error) {
			// Specs can act as a different caller by attaching the
			// "x-test-user" metadata key with a user UUID.
			if md, ok := metadata.FromIncomingContext(ctx); ok {
				if vals := md.Get("x-test-user"); len(vals) == 1 && vals[0] != "" {
					return handler(authz.WithUser(ctx, vals[0], authz.AllAPIScopes), req)
				}
			}
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
	gen.RegisterUserServiceServer(s, svc.User)
	gen.RegisterCommitteeServiceServer(s, svc.Committee)
	gen.RegisterSubmissionServiceServer(s, svc.Submission)
	gen.RegisterSubmissionItemServiceServer(s, svc.SubmissionItem)
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
	UserClient = gen.NewUserServiceClient(conn)
	CommitteeClient = gen.NewCommitteeServiceClient(conn)
	SubmissionClient = gen.NewSubmissionServiceClient(conn)
	SubmissionItemClient = gen.NewSubmissionItemServiceClient(conn)

	DeferCleanup(func() {
		_ = conn.Close()
		_ = lis.Close()
		s.GracefulStop()
	})
})
