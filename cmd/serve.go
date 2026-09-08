package cmd

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"github.com/pixlcrashr/vsfv/pkg/api"
	apiserv "github.com/pixlcrashr/vsfv/pkg/api/grpc"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services"
	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/auth"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the HTTP API server",
	Long: `Start the VS-Finanzverwaltung HTTP API server.

The server connects to the configured PostgreSQL database and listens for
incoming HTTP requests. It shuts down gracefully on SIGINT or SIGTERM.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		gormDB, err := db.Connect(config.Database.DSN)
		if err != nil {
			return fmt.Errorf("connecting to database: %w", err)
		}

		sqlDB, err := gormDB.DB()
		if err != nil {
			return fmt.Errorf("getting underlying sql.DB: %w", err)
		}
		defer sqlDB.Close()

		enforcer, err := authz.NewEnforcer(gormDB)
		if err != nil {
			return fmt.Errorf("creating casbin enforcer: %w", err)
		}

		// Seed admin system group and sync its wildcard policy
		if err := authz.SeedAdminGroup(context.Background(), gormDB, enforcer); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to seed admin group: %v\n", err)
		}

		svcSet := services.New(gormDB, enforcer)

		// Create repositories for auth
		userRepo := repository.NewUserRepository(gormDB)
		identityRepo := repository.NewUserIdentityRepository(gormDB)
		clientRepo := repository.NewOAuth2ClientRepository(gormDB)
		tokenRepo := repository.NewOAuth2TokenRepository(gormDB)
		sessionRepo := repository.NewAuthSessionRepository(gormDB)

		// Seed default OAuth2 client
		if err := auth.SeedDefaultClient(context.Background(), clientRepo, config.Server.PublicURL, config.Auth.WebRedirectURIs); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to seed default OAuth2 client: %v\n", err)
		}

		// Create auth server
		authSrv, err := auth.NewServer(gormDB, config.Auth, config.Server.PublicURL, userRepo, clientRepo, tokenRepo, sessionRepo)
		if err != nil {
			return fmt.Errorf("creating auth server: %w", err)
		}

		// Create GitLab handler
		gitlabHandler := auth.NewGitLabHandler(config.Auth, config.Server.PublicURL, userRepo, identityRepo, authSrv.SessionManager(), audit.NewWriter(gormDB))

		grpcSrv, err := apiserv.NewGRPCServer(config.Server.GRPCAddress, svcSet)
		if err != nil {
			return fmt.Errorf("creating gRPC server: %w", err)
		}

		srv := api.New(gormDB, svcSet, "dev", config.CORS, authSrv, gitlabHandler)

		fmt.Printf("Listening on %s (HTTP)\n", config.Server.Address)
		fmt.Printf("Listening on %s (gRPC)\n", grpcSrv.Addr())

		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

		go func() {
			if err := srv.Listen(config.Server.Address); err != nil {
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

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = ctx

		grpcSrv.Stop()

		if err := srv.Shutdown(); err != nil {
			return fmt.Errorf("shutdown: %w", err)
		}

		fmt.Println("Server stopped.")
		return nil
	},
}

func init() {
	rootCmd.AddCommand(serveCmd)
}
