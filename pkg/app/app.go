// Package app assembles the vsfv runtime — database, authorization, auth
// server, gRPC services and the HTTP/gRPC servers — and runs it until a
// shutdown signal arrives.
package app

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"gorm.io/gorm"

	"github.com/pixlcrashr/vsfv/pkg/api"
	apiserv "github.com/pixlcrashr/vsfv/pkg/api/grpc"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services"
	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/auth"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/cfg"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

// Run boots the server stack described by cfg: it connects to the database,
// wires the auth and service layers, starts the HTTP and gRPC servers, and
// blocks until SIGINT or SIGTERM arrives. Both servers are then shut down
// gracefully.
func Run(cfg *cfg.Config) error {
	gormDB, err := db.Connect(cfg.Database.DSN)
	if err != nil {
		return fmt.Errorf("connecting to database: %w", err)
	}

	sqlDB, err := gormDB.DB()
	if err != nil {
		return fmt.Errorf("getting underlying sql.DB: %w", err)
	}
	defer sqlDB.Close()

	enforcer, err := newEnforcer(gormDB)
	if err != nil {
		return err
	}

	authDeps, err := newAuthDeps(gormDB, cfg)
	if err != nil {
		return err
	}

	svcSet := services.New(gormDB, enforcer, authDeps.passwordLogin, cfg.Auth.GitLab.Enabled)

	grpcSrv, err := apiserv.NewGRPCServer(cfg.Server.GRPCAddress, svcSet)
	if err != nil {
		return fmt.Errorf("creating gRPC server: %w", err)
	}

	srv := api.New(gormDB, svcSet, "dev", cfg.CORS, authDeps.server, authDeps.gitlabHandler, enforcer, cfg.Storage.AttachmentsPath)

	// Background sweeper: auto-rejects pending submissions whose
	// organization-wide deadline has passed.
	sweepStop := make(chan struct{})
	defer close(sweepStop)
	go runSubmissionDecaySweeper(context.Background(), gormDB, cfg.SubmissionDecay.Interval, sweepStop)

	return runServers(srv, grpcSrv, cfg.Server.Address)
}

// authDeps groups the OAuth2 server and login handlers built by newAuthDeps.
type authDeps struct {
	server        *auth.Server
	gitlabHandler *auth.GitLabHandler
	passwordLogin *auth.PasswordLoginProvider
}

// newEnforcer creates the casbin enforcer and best-effort seeds the admin
// system group with its wildcard policy.
func newEnforcer(gormDB *gorm.DB) (*authz.Enforcer, error) {
	enforcer, err := authz.NewEnforcer(gormDB)
	if err != nil {
		return nil, fmt.Errorf("creating casbin enforcer: %w", err)
	}

	if err := authz.SeedAdminGroup(context.Background(), gormDB, enforcer); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to seed admin group: %v\n", err)
	}
	return enforcer, nil
}

// newAuthDeps builds the OAuth2 server plus the GitLab and password login
// handlers, and best-effort seeds the default OAuth2 client.
func newAuthDeps(gormDB *gorm.DB, cfg *cfg.Config) (*authDeps, error) {
	userRepo := repository.NewUserRepository(gormDB)
	identityRepo := repository.NewUserIdentityRepository(gormDB)
	clientRepo := repository.NewOAuth2ClientRepository(gormDB)
	tokenRepo := repository.NewOAuth2TokenRepository(gormDB)
	sessionRepo := repository.NewAuthSessionRepository(gormDB)

	if err := auth.SeedDefaultClient(context.Background(), clientRepo, cfg.Server.PublicURL, cfg.Auth.WebRedirectURIs); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to seed default OAuth2 client: %v\n", err)
	}

	authSrv, err := auth.NewServer(gormDB, cfg.Auth, cfg.Server.PublicURL, userRepo, clientRepo, tokenRepo, sessionRepo)
	if err != nil {
		return nil, fmt.Errorf("creating auth server: %w", err)
	}

	gitlabHandler := auth.NewGitLabHandler(cfg.Auth, cfg.Server.PublicURL, userRepo, identityRepo, authSrv.SessionManager(), audit.NewWriter(gormDB))

	passwordLogin, err := auth.NewPasswordLoginProvider(userRepo, authSrv.SessionManager(), cfg.Auth.Password.Enabled, auth.WebClientAuthorizeURL(cfg.Server.PublicURL))
	if err != nil {
		return nil, fmt.Errorf("creating password login provider: %w", err)
	}

	return &authDeps{server: authSrv, gitlabHandler: gitlabHandler, passwordLogin: passwordLogin}, nil
}

// runServers starts srv (HTTP) and grpcSrv in the background, blocks until
// SIGINT/SIGTERM, then stops both servers gracefully.
func runServers(srv *api.Server, grpcSrv *apiserv.GRPCServer, httpAddr string) error {
	fmt.Printf("Listening on %s (HTTP)\n", httpAddr)
	fmt.Printf("Listening on %s (gRPC)\n", grpcSrv.Addr())

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := srv.Listen(httpAddr); err != nil {
			fmt.Fprintf(os.Stderr, "HTTP server error: %v\n", err)
		}
	}()

	go func() {
		if err := grpcSrv.Serve(); err != nil {
			fmt.Fprintf(os.Stderr, "gRPC server error: %v\n", err)
		}
	}()

	sig := <-quit
	fmt.Printf("\nReceived signal %s, shutting down gracefully...\n", sig)

	grpcSrv.Stop()

	if err := srv.Shutdown(); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}

	fmt.Println("Server stopped.")
	return nil
}
