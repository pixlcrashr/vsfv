package auth

import (
	"context"
	"errors"
	"net/http"

	"github.com/ory/fosite"
	"github.com/pixlcrashr/vsfv/pkg/authz"
)

// ErrNoSubject is returned by AuthenticateToken when the token is valid but
// carries no user subject.
var ErrNoSubject = errors.New("no subject in token")

// AuthenticateToken introspects the given Bearer token via fosite and returns a
// context carrying the user ID and granted scopes. It is the shared primitive
// behind HTTPMiddleware and the Huma-based exception endpoints.
func AuthenticateToken(ctx context.Context, oauth2 fosite.OAuth2Provider, sessionFactory func() fosite.Session, token string) (context.Context, error) {
	session := sessionFactory()

	_, ar, err := oauth2.IntrospectToken(ctx, token, fosite.AccessToken, session)
	if err != nil {
		return nil, err
	}

	userID := ar.GetSession().GetSubject()
	if userID == "" {
		return nil, ErrNoSubject
	}

	var scopes []string
	if granted := ar.GetGrantedScopes(); granted != nil {
		scopes = granted
	}

	return authz.WithUser(ctx, userID, scopes), nil
}

// HTTPMiddleware wraps an http.Handler with Bearer token authentication.
// It introspects the token via fosite, extracts the user ID and granted scopes,
// and stores them in the request context for downstream handlers.
func HTTPMiddleware(oauth2 fosite.OAuth2Provider, sessionFactory func() fosite.Session) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := getBearerToken(r)
			if token == "" {
				writeJSONError(w, http.StatusUnauthorized, "invalid_token", "missing bearer token")
				return
			}

			ctx, err := AuthenticateToken(r.Context(), oauth2, sessionFactory, token)
			if err != nil {
				if errors.Is(err, ErrNoSubject) {
					writeJSONError(w, http.StatusUnauthorized, "invalid_token", "no subject in token")
				} else {
					writeJSONError(w, http.StatusUnauthorized, "invalid_token", "token validation failed")
				}
				return
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
