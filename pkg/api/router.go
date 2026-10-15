package api

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/ory/fosite"
	"gorm.io/gorm"

	"github.com/pixlcrashr/vsfv/pkg/api/attachments"
	"github.com/pixlcrashr/vsfv/pkg/api/humax"
	"github.com/pixlcrashr/vsfv/pkg/api/importexport/xmlformat"
	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/auth"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/storage"
)

// RegisterRoutes wires all domain route groups onto the Huma API. These are
// the exception endpoints that live outside the protobuf-generated
// grpc-gateway API; they are registered before the gateway's /api/v1/*
// catch-all so Fiber's registration-order matching picks them first.
func RegisterRoutes(api huma.API, db *gorm.DB, authSrv *auth.Server, enforcer *authz.Enforcer, fileStorage *storage.FileStorage, audits *audit.Writer) {
	var authDeps *humax.AuthDeps
	if authSrv != nil {
		authDeps = &humax.AuthDeps{
			OAuth2:         authSrv.OAuth2(),
			SessionFactory: func() fosite.Session { return auth.NewSession(nil) },
		}
	}
	xmlformat.RegisterRoutes(api, db, authDeps, enforcer)
	attachments.RegisterRoutes(api, db, &attachments.Deps{
		Auth:     authDeps,
		Enforcer: enforcer,
		Storage:  fileStorage,
		Audits:   audits,
	})
}
