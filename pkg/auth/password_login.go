package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strings"

	"github.com/pixlcrashr/vsfv/pkg/auth/passwordhash"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var (
	// ErrPasswordAuthDisabled is returned when login is attempted while
	// password authentication is disabled in the configuration.
	ErrPasswordAuthDisabled = errors.New("password authentication is disabled")
	// ErrInvalidCredentials is returned when the email does not match a
	// user with a password or the password is wrong.
	ErrInvalidCredentials = errors.New("invalid email or password")
)

// webClientScopes is the OAuth2 scope list requested by the first-party web
// client; must be kept in sync with the SPA's auth config.
const webClientScopes = "openid profile email offline"

// WebClientAuthorizeURL returns the OAuth2 authorization endpoint URL for
// the seeded first-party web client. After a successful password login the
// browser follows this URL; because the session cookie is set at that
// point, the authorize endpoint immediately redirects back to the client
// with an authorization code.
func WebClientAuthorizeURL(publicURL string) string {
	return fmt.Sprintf("%s/oauth2/authorize?client_id=%s&response_type=code&scope=%s",
		strings.TrimSuffix(publicURL, "/"),
		url.QueryEscape(DefaultWebClientID),
		url.QueryEscape(webClientScopes),
	)
}

// PasswordLoginProvider authenticates existing users with email and
// password credentials. It does not create users; accounts are provisioned
// by the admin (adduser CLI) or the GitLab SSO flow.
type PasswordLoginProvider struct {
	users    *repository.UserRepository
	sessions *SessionManager
	enabled  bool

	authorizeURL string
	// dummyHash is verified against when no matching user exists so that
	// unknown emails take a comparable amount of time as wrong passwords.
	dummyHash string
}

// NewPasswordLoginProvider creates the provider. authorizeURL is the URL
// returned on successful logins, see WebClientAuthorizeURL.
func NewPasswordLoginProvider(users *repository.UserRepository, sessions *SessionManager, enabled bool, authorizeURL string) (*PasswordLoginProvider, error) {
	dummy := make([]byte, 32)
	if _, err := rand.Read(dummy); err != nil {
		return nil, fmt.Errorf("generating dummy password: %w", err)
	}
	dummyHash, err := passwordhash.Hash(string(dummy))
	if err != nil {
		return nil, fmt.Errorf("generating dummy hash: %w", err)
	}

	return &PasswordLoginProvider{
		users:        users,
		sessions:     sessions,
		enabled:      enabled,
		authorizeURL: authorizeURL,
		dummyHash:    dummyHash,
	}, nil
}

// Enabled reports whether password authentication is enabled.
func (p *PasswordLoginProvider) Enabled() bool {
	return p.enabled
}

// Login verifies the credentials and creates a browser session. On success
// it returns the OAuth2 authorize URL the browser should follow next and
// the Set-Cookie value establishing the session.
func (p *PasswordLoginProvider) Login(ctx context.Context, email, password string) (string, string, error) {
	if !p.enabled {
		return "", "", ErrPasswordAuthDisabled
	}

	user, err := p.users.GetByEmail(ctx, email)
	if err != nil {
		_ = passwordhash.Verify(p.dummyHash, password)
		return "", "", ErrInvalidCredentials
	}

	if !user.PasswordHash.Valid || user.PasswordHash.String == "" {
		_ = passwordhash.Verify(p.dummyHash, password)
		return "", "", ErrInvalidCredentials
	}

	if err := passwordhash.Verify(user.PasswordHash.String, password); err != nil {
		return "", "", ErrInvalidCredentials
	}

	// Transparently upgrade legacy hashes to the current argon2id format.
	if passwordhash.NeedsRehash(user.PasswordHash.String) {
		if rehashed, err := passwordhash.Hash(password); err == nil {
			if err := p.users.UpdatePasswordHash(ctx, user.ID, rehashed); err != nil {
				log.Printf("upgrading password hash of user %s: %v", user.ID, err)
			}
		}
	}

	session, err := p.sessions.CreateSession(ctx, user.ID)
	if err != nil {
		return "", "", fmt.Errorf("creating session: %w", err)
	}

	return p.authorizeURL, p.sessions.SessionCookieString(session.Token), nil
}
