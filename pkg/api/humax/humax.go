// Package humax provides shared plumbing for the Huma-based exception
// endpoints (routes that live outside the protobuf-generated gRPC-gateway
// API): Bearer-token authentication and the legacy `{"error": ...}` error body
// shape consumed by the SPA.
package humax

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/ory/fosite"
	"github.com/pixlcrashr/vsfv/pkg/auth"
	"github.com/pixlcrashr/vsfv/pkg/authz"
)

// AuthDeps carries the OAuth2 provider used to introspect Bearer tokens. A nil
// *AuthDeps disables authentication (used by tests and deployments without an
// auth server).
type AuthDeps struct {
	OAuth2         fosite.OAuth2Provider
	SessionFactory func() fosite.Session
}

// Auth authenticates the request via its Authorization header and returns a
// context carrying the user ID and granted scopes (see
// auth.AuthenticateToken). Handlers declare the header on their input struct
// (`Authorization string \`header:"Authorization"\“) and call this first,
// passing the returned context to all downstream calls.
func Auth(ctx context.Context, deps *AuthDeps, authorization string) (context.Context, error) {
	if deps == nil {
		return ctx, nil
	}
	authed, err := auth.AuthenticateToken(ctx, deps.OAuth2, deps.SessionFactory, bearerToken(authorization))
	if err != nil {
		return nil, NewError(http.StatusUnauthorized, "unauthorized")
	}
	return authed, nil
}

// CheckGlobal runs the given global permission check against the
// authenticated context. A nil enforcer disables the check (used by tests).
// Errors are mapped to the legacy error body shape.
func CheckGlobal(ctx context.Context, enforcer *authz.Enforcer, resource, action string) error {
	if enforcer == nil {
		return nil
	}
	if err := authz.CheckGlobal(ctx, enforcer, resource, action); err != nil {
		return permissionError(err)
	}
	return nil
}

func permissionError(err error) error {
	if errors.Is(err, authz.ErrUnauthenticated) {
		return NewError(http.StatusUnauthorized, err.Error())
	}
	return NewError(http.StatusForbidden, err.Error())
}

func bearerToken(header string) string {
	return strings.TrimSpace(strings.TrimPrefix(header, "Bearer"))
}

// writeError writes the legacy `{"error": ...}` body directly to the response.
func writeError(humactx huma.Context, status int, message string) {
	humactx.SetStatus(status)
	humactx.SetHeader("Content-Type", "application/json; charset=utf-8")
	_, _ = fmt.Fprintf(humactx.BodyWriter(), "{\"error\": %q}\n", message)
}

// statusError is a Huma StatusError whose marshaled body keeps the legacy
// `{"error": ...}` shape that the SPA expects (huma writes the returned error
// object itself as the response body).
type statusError struct {
	status  int
	message string
}

func (e *statusError) Error() string {
	return e.message
}

func (e *statusError) GetStatus() int {
	return e.status
}

// NewError returns an error carrying an HTTP status whose response body keeps
// the legacy `{"error": ...}` shape.
func NewError(status int, message string) error {
	return &statusError{status: status, message: message}
}
