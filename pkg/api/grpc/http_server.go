package grpc

import (
	"context"
	"log"
	"net/http"
	"runtime/debug"

	"github.com/gofiber/adaptor/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
)

// recoveryHandler wraps an http.Handler with a recover that logs the panic
// value and full stack trace. This is needed because the fasthttp adaptor
// re-panics in a different goroutine, hiding the original panic location.
type recoveryHandler struct {
	inner http.Handler
}

func (h *recoveryHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("panic in grpc-gateway handler: %v\n%s", rec, debug.Stack())
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}
	}()
	h.inner.ServeHTTP(w, r)
}

// RegisterRoutes registers the grpc-gateway HTTP/JSON transcoded routes onto
// the given Fiber app. All gRPC service implementations are wired in-process
// (no TCP gRPC listener is required). If authMiddleware is non-nil, it is
// applied to all /api/v1/* routes for Bearer token authentication.
func RegisterRoutes(app *fiber.App, svc *services.Services, authMiddleware func(http.Handler) http.Handler) {
	mux := runtime.NewServeMux(
		runtime.WithMarshalerOption(runtime.MIMEWildcard, &runtime.JSONPb{
			MarshalOptions: protojson.MarshalOptions{
				UseProtoNames:   true,
				EmitUnpopulated: false,
			},
			UnmarshalOptions: protojson.UnmarshalOptions{
				DiscardUnknown: true,
			},
		}),
	)

	ctx := context.Background()

	mustRegister(gen.RegisterOrganizationServiceHandlerServer(ctx, mux, svc.Organization))
	mustRegister(gen.RegisterAccountServiceHandlerServer(ctx, mux, svc.Account))
	mustRegister(gen.RegisterAccountGroupServiceHandlerServer(ctx, mux, svc.AccountGroup))
	mustRegister(gen.RegisterAccountGroupAssignmentServiceHandlerServer(ctx, mux, svc.AccountGroupAssignment))
	mustRegister(gen.RegisterBudgetServiceHandlerServer(ctx, mux, svc.Budget))
	mustRegister(gen.RegisterBudgetRevisionServiceHandlerServer(ctx, mux, svc.BudgetRevision))
	mustRegister(gen.RegisterBudgetRevisionAccountValueServiceHandlerServer(ctx, mux, svc.BudgetRevisionAccountValue))
	mustRegister(gen.RegisterBudgetAccountValueServiceHandlerServer(ctx, mux, svc.BudgetAccountValue))
	mustRegister(gen.RegisterBudgetActualAccountValueServiceHandlerServer(ctx, mux, svc.BudgetActualAccountValue))
	mustRegister(gen.RegisterLedgerYearServiceHandlerServer(ctx, mux, svc.LedgerYear))
	mustRegister(gen.RegisterLedgerAccountServiceHandlerServer(ctx, mux, svc.LedgerAccount))
	mustRegister(gen.RegisterTransactionServiceHandlerServer(ctx, mux, svc.Transaction))
	mustRegister(gen.RegisterTransactionAssignmentServiceHandlerServer(ctx, mux, svc.TransactionAssignment))
	mustRegister(gen.RegisterReportTemplateServiceHandlerServer(ctx, mux, svc.ReportTemplate))
	mustRegister(gen.RegisterReportServiceHandlerServer(ctx, mux, svc.Report))
	mustRegister(gen.RegisterUserServiceHandlerServer(ctx, mux, svc.User))
	mustRegister(gen.RegisterUserSettingsServiceHandlerServer(ctx, mux, svc.UserSettings))
	mustRegister(gen.RegisterUserIdentityServiceHandlerServer(ctx, mux, svc.UserIdentity))
	mustRegister(gen.RegisterGroupServiceHandlerServer(ctx, mux, svc.Group))
	mustRegister(gen.RegisterAuditLogServiceHandlerServer(ctx, mux, svc.AuditLog))

	handler := http.StripPrefix("/api", http.Handler(mux))
	if authMiddleware != nil {
		handler = authMiddleware(handler)
	}
	handler = &recoveryHandler{inner: handler}

	app.All("/api/v1/*", adaptor.HTTPHandler(handler))
}

func mustRegister(err error) {
	if err != nil {
		panic("grpc-gateway registration failed: " + err.Error())
	}
}
