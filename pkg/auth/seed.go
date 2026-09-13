package auth

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	"github.com/pixlcrashr/vsfv/pkg/db/types"
)

const DefaultWebClientID = "web-app"

// defaultWebClientScopes returns the full scope list for the trusted
// first-party web client.
func defaultWebClientScopes() types.StringArray {
	return types.StringArray(append([]string{"openid", "profile", "email", "offline"}, authz.AllAPIScopes...))
}

// SeedDefaultClient creates the default web client if it doesn't already exist
// and re-syncs its scopes on every startup so newly added API scopes (e.g.
// auditLogs:read) are granted to existing installations as well. Redirect URIs
// are taken from webRedirectURIs if non-empty, otherwise derived from the
// public URL as {publicURL}/login.
func SeedDefaultClient(ctx context.Context, repo *repository.OAuth2ClientRepository, publicURL string, webRedirectURIs []string) error {
	scopes := defaultWebClientScopes()

	existing, err := repo.GetByClientID(ctx, DefaultWebClientID)
	if err == nil {
		// Re-sync the scopes to pick up API scopes added after the client was
		// first seeded. Without this, tokens issued for the trusted web client
		// never contain the new scopes and every endpoint guarded by them
		// fails the scope check, regardless of the user's permissions.
		if !scopesEqual([]string(existing.Scopes), []string(scopes)) {
			log.Printf("Re-syncing scopes of default OAuth2 client %q", DefaultWebClientID)
			if err := repo.UpdateScopes(ctx, DefaultWebClientID, scopes); err != nil {
				return fmt.Errorf("seeding default client: %w", err)
			}
		}
		return nil
	}
	if !errors.Is(err, repository.ErrOAuth2ClientNotFound) {
		return fmt.Errorf("seeding default client: %w", err)
	}

	redirectURIs := webRedirectURIs
	if len(redirectURIs) == 0 {
		redirectURIs = []string{strings.TrimSuffix(publicURL, "/") + "/login"}
	}

	log.Printf("Seeding default OAuth2 client %q with redirect URIs %v", DefaultWebClientID, redirectURIs)

	_, err = repo.Create(ctx, repository.CreateOAuth2ClientParams{
		ClientID:      DefaultWebClientID,
		ClientName:    "Web",
		RedirectURIs:  types.StringArray(redirectURIs),
		GrantTypes:    types.StringArray{"authorization_code", "refresh_token"},
		ResponseTypes: types.StringArray{"code", "code id_token"},
		Scopes:        scopes,
		Public:        true,
	})
	if err != nil {
		return fmt.Errorf("seeding default client: %w", err)
	}
	return nil
}

// scopesEqual compares two scope lists ignoring order.
func scopesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	set := make(map[string]struct{}, len(a))
	for _, s := range a {
		set[s] = struct{}{}
	}
	for _, s := range b {
		if _, ok := set[s]; !ok {
			return false
		}
	}
	return true
}
