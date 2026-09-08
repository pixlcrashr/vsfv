package grpc

import (
	"net"

	googlegrpc "google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
)

// GRPCServer wraps a native gRPC server bound to a TCP listener.
// Standard gRPC clients (e.g. grpcurl, generated stubs) connect directly
// to its port using the gRPC wire protocol.
type GRPCServer struct {
	grpc     *googlegrpc.Server
	listener net.Listener
}

// NewGRPCServer creates a [GRPCServer] that registers all service
// implementations from svc and listens on addr (e.g. "127.0.0.1:9090").
// gRPC server reflection is enabled so tooling like grpcurl works out of the
// box.
func NewGRPCServer(addr string, svc *services.Services, opts ...googlegrpc.ServerOption) (*GRPCServer, error) {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, err
	}

	s := googlegrpc.NewServer(opts...)

	gen.RegisterOrganizationServiceServer(s, svc.Organization)
	gen.RegisterAccountServiceServer(s, svc.Account)
	gen.RegisterAccountGroupServiceServer(s, svc.AccountGroup)
	gen.RegisterAccountGroupAssignmentServiceServer(s, svc.AccountGroupAssignment)
	gen.RegisterBudgetServiceServer(s, svc.Budget)
	gen.RegisterBudgetRevisionServiceServer(s, svc.BudgetRevision)
	gen.RegisterBudgetRevisionAccountValueServiceServer(s, svc.BudgetRevisionAccountValue)
	gen.RegisterBudgetAccountValueServiceServer(s, svc.BudgetAccountValue)
	gen.RegisterBudgetActualAccountValueServiceServer(s, svc.BudgetActualAccountValue)
	gen.RegisterLedgerYearServiceServer(s, svc.LedgerYear)
	gen.RegisterLedgerAccountServiceServer(s, svc.LedgerAccount)
	gen.RegisterTransactionServiceServer(s, svc.Transaction)
	gen.RegisterTransactionAssignmentServiceServer(s, svc.TransactionAssignment)
	gen.RegisterReportTemplateServiceServer(s, svc.ReportTemplate)
	gen.RegisterReportServiceServer(s, svc.Report)
	gen.RegisterAuditLogServiceServer(s, svc.AuditLog)

	reflection.Register(s)

	return &GRPCServer{grpc: s, listener: lis}, nil
}

// Serve starts accepting gRPC connections on the bound listener.
// This call blocks until the server is stopped.
func (g *GRPCServer) Serve() error {
	return g.grpc.Serve(g.listener)
}

// Stop gracefully stops the gRPC server, blocking until all in-flight RPCs
// have completed.
func (g *GRPCServer) Stop() {
	g.grpc.GracefulStop()
}

// Addr returns the listening address (useful for logging).
func (g *GRPCServer) Addr() net.Addr {
	return g.listener.Addr()
}
