package cmd

import (
	"github.com/spf13/cobra"

	"github.com/pixlcrashr/vsfv/pkg/app"
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the HTTP API server",
	Long: `Start the VS-Finanzverwaltung HTTP API server.

The server connects to the configured PostgreSQL database and listens for
incoming HTTP requests. It shuts down gracefully on SIGINT or SIGTERM.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return app.Run(config)
	},
}

func init() {
	rootCmd.AddCommand(serveCmd)
}
