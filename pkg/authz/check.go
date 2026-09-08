package authz

import (
	"context"
	"errors"
	"fmt"
)

var (
	ErrUnauthenticated  = errors.New("unauthenticated: no user ID in context")
	ErrScopeDenied      = errors.New("permission denied: insufficient scope")
	ErrPermissionDenied = errors.New("permission denied: casbin check failed")
)

// CheckGlobal verifies that the authenticated user has both the required
// OAuth2 scope and the casbin permission for a global resource/action.
//
// Parameters:
//   - ctx: must contain user ID and scopes (set by auth middleware)
//   - enforcer: casbin enforcer
//   - resource: casbin resource (e.g. authz.ResourceUsers)
//   - action: casbin action (e.g. authz.ActionRead)
//
// Returns nil if authorized, an error otherwise.
func CheckGlobal(ctx context.Context, enforcer *Enforcer, resource, action string) error {
	userID, ok := UserIDFromContext(ctx)
	if !ok {
		return ErrUnauthenticated
	}

	requiredScope := ActionToScope(resource, action)
	scopes, _ := ScopesFromContext(ctx)
	if !HasScope(scopes, requiredScope) {
		return fmt.Errorf("%w: required %s", ErrScopeDenied, requiredScope)
	}

	allowed, err := enforcer.Enforce(userID, GlobalDomain, resource, action)
	if err != nil {
		return fmt.Errorf("casbin enforce: %w", err)
	}
	if !allowed {
		return fmt.Errorf("%w: %s/%s on %s", ErrPermissionDenied, resource, action, GlobalDomain)
	}

	return nil
}

// CheckScopes verifies that the authenticated user holds the OAuth2 scope
// required for resource/action, without performing a casbin check.
func CheckScopes(ctx context.Context, resource, action string) error {
	requiredScope := ActionToScope(resource, action)
	scopes, _ := ScopesFromContext(ctx)
	if !HasScope(scopes, requiredScope) {
		return fmt.Errorf("%w: required %s", ErrScopeDenied, requiredScope)
	}
	return nil
}

// CheckOrg verifies that the authenticated user has both the required OAuth2
// scope and the casbin permission for an organization-scoped resource/action.
//
// Parameters:
//   - ctx: must contain user ID and scopes (set by auth middleware)
//   - enforcer: casbin enforcer
//   - resource: casbin resource (e.g. authz.ResourceAccounts)
//   - action: casbin action (e.g. authz.ActionRead)
//   - orgDomain: organization domain in "organizations/{id}" format
//
// Returns nil if authorized, an error otherwise.
func CheckOrg(ctx context.Context, enforcer *Enforcer, resource, action, orgDomain string) error {
	userID, ok := UserIDFromContext(ctx)
	if !ok {
		return ErrUnauthenticated
	}

	requiredScope := ActionToScope(resource, action)
	scopes, _ := ScopesFromContext(ctx)
	if !HasScope(scopes, requiredScope) {
		return fmt.Errorf("%w: required %s", ErrScopeDenied, requiredScope)
	}

	allowed, err := enforcer.Enforce(userID, orgDomain, resource, action)
	if err != nil {
		return fmt.Errorf("casbin enforce: %w", err)
	}
	if !allowed {
		return fmt.Errorf("%w: %s/%s on %s", ErrPermissionDenied, resource, action, orgDomain)
	}

	return nil
}
