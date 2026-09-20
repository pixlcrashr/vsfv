package api

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humafiber"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/etag"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/ory/fosite"
	"gorm.io/gorm"

	apiserv "github.com/pixlcrashr/vsfv/pkg/api/grpc"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services"
	"github.com/pixlcrashr/vsfv/pkg/auth"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/cfg"
	"github.com/pixlcrashr/vsfv/web"
)

// maxXMLRequestBodySize is the Fiber request body limit. It leaves room for
// full-organization XML imports (fasthttp defaults to 4 MiB).
const maxXMLRequestBodySize = 32 << 20

// Server wraps the Fiber app and the Huma API instance.
type Server struct {
	app *fiber.App
	API huma.API
}

// New creates a Server, registers all routes, and returns it ready to listen.
// svc is the shared service set used by both the grpc-gateway JSON API and the
// Huma REST API.  db is still required for the routes that have not yet been
// migrated to the service layer. enforcer guards the routes that cannot use
// the service-layer permission checks (XML import/export).
func New(db *gorm.DB, svc *services.Services, version string, corsCfg cfg.CORS, authSrv *auth.Server, gitlabHandler *auth.GitLabHandler, enforcer *authz.Enforcer, attachmentsPath string) *Server {
	app := fiber.New(fiber.Config{
		// Disable default startup banner — the serve command prints its own.
		DisableStartupMessage: true,
		CaseSensitive:         true,
		// Room for full-organization XML imports; fasthttp defaults to 4 MiB.
		BodyLimit: maxXMLRequestBodySize,
	})
	app.Use(etag.New())

	if corsCfg.Enabled {
		app.Use(cors.New(cors.Config{
			AllowOrigins:     strings.Join(corsCfg.AllowOrigins, ","),
			AllowMethods:     strings.Join(corsCfg.AllowMethods, ","),
			AllowHeaders:     strings.Join(corsCfg.AllowHeaders, ","),
			ExposeHeaders:    strings.Join(corsCfg.ExposeHeaders, ","),
			AllowCredentials: corsCfg.AllowCredentials,
			MaxAge:           corsCfg.MaxAge,
		}))
	}

	humaConfig := huma.DefaultConfig("VS-Finanzverwaltung API", version)
	api := humafiber.New(app, humaConfig)

	// Build auth middleware for the grpc-gateway routes. The Huma exception
	// endpoints authenticate via authSrv directly (see humax).
	var authMiddleware func(http.Handler) http.Handler
	if authSrv != nil {
		authMiddleware = auth.HTTPMiddleware(authSrv.OAuth2(), func() fosite.Session {
			return auth.NewSession(nil)
		})
	}

	s := &Server{app: app, API: api}
	RegisterRoutes(s.API, db, authSrv, enforcer, attachmentsPath)

	apiserv.RegisterRoutes(app, svc, authMiddleware)

	// Register OAuth2/OIDC auth routes
	if authSrv != nil {
		auth.RegisterRoutes(app, authSrv, gitlabHandler)
	}

	// Serve embedded Angular app (non-API routes only)
	if webFS := web.FS(); webFS != nil {
		staticFS, err := fs.Sub(webFS, ".")
		if err == nil {
			// Serve static files from embedded filesystem
			app.Use("/", filesystem.New(filesystem.Config{
				Root:         http.FS(staticFS),
				Browse:       false,
				NotFoundFile: "index.html",
			}))
		}
	}

	return s
}

// Listen starts the HTTP server on the given address (e.g. "127.0.0.1:8080").
func (s *Server) Listen(addr string) error {
	return s.app.Listen(addr)
}

// Shutdown gracefully drains in-flight requests.
func (s *Server) Shutdown() error {
	return s.app.Shutdown()
}
