package api

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"github.com/pixlcrashr/vsfv/pkg/api/importexport/xmlformat"
	"github.com/pixlcrashr/vsfv/pkg/authz"
)

// RegisterRoutes wires all domain route groups onto the Huma API and Fiber app.
// authMiddleware is the Bearer-token middleware shared with the grpc-gateway
// API; routes registered here must be mounted before the gateway's /api/v1/*
// catch-all.
func RegisterRoutes(app *fiber.App, api huma.API, db *gorm.DB, authMiddleware func(http.Handler) http.Handler, enforcer *authz.Enforcer) {
	xmlformat.RegisterRoutes(app, db, authMiddleware, enforcer)
}
