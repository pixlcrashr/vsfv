package auth

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gofiber/adaptor/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/cfg"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	"github.com/theater-improrama/go-utils/optional"
	"golang.org/x/oauth2"
)

const (
	gitlabProviderName = "gitlab"
	StateCookieName    = "vsfv_oauth_state"
	ReturnToCookieName = "vsfv_oauth_return_to"
	stateCookieMaxAge  = 300 // 5 minutes
)

type GitLabHandler struct {
	cfg           cfgGitLab
	userRepo      *repository.UserRepository
	identityRepo  *repository.UserIdentityRepository
	sessionMgr    *SessionManager
	oauth2Config  *oauth2.Config
	audits        *audit.Writer
	secureCookies bool
}

type cfgGitLab interface {
	IsEnabled() bool
	GetClientID() string
	GetClientSecret() string
	GetIssuer() string
}

type gitlabConfigAdapter struct {
	enabled      bool
	clientID     string
	clientSecret string
	issuer       string
}

func (g gitlabConfigAdapter) IsEnabled() bool         { return g.enabled }
func (g gitlabConfigAdapter) GetClientID() string     { return g.clientID }
func (g gitlabConfigAdapter) GetClientSecret() string { return g.clientSecret }
func (g gitlabConfigAdapter) GetIssuer() string       { return g.issuer }

func NewGitLabHandler(
	authCfg cfg.Auth,
	publicURL string,
	userRepo *repository.UserRepository,
	identityRepo *repository.UserIdentityRepository,
	sessionMgr *SessionManager,
	audits *audit.Writer,
) *GitLabHandler {
	adapter := gitlabConfigAdapter{
		enabled:      authCfg.GitLab.Enabled,
		clientID:     authCfg.GitLab.ClientID,
		clientSecret: authCfg.GitLab.ClientSecret,
		issuer:       authCfg.GitLab.Issuer,
	}

	g := &GitLabHandler{
		cfg:           adapter,
		userRepo:      userRepo,
		identityRepo:  identityRepo,
		sessionMgr:    sessionMgr,
		audits:        audits,
		secureCookies: authCfg.SecureCookies,
	}

	if adapter.IsEnabled() {
		issuer := strings.TrimSuffix(adapter.GetIssuer(), "/")
		g.oauth2Config = &oauth2.Config{
			ClientID:     adapter.GetClientID(),
			ClientSecret: adapter.GetClientSecret(),
			RedirectURL:  strings.TrimSuffix(publicURL, "/") + "/auth/gitlab/callback",
			Endpoint: oauth2.Endpoint{
				AuthURL:  issuer + "/oauth/authorize",
				TokenURL: issuer + "/oauth/token",
			},
			Scopes: []string{"openid", "profile", "email"},
		}
	}

	return g
}

func (g *GitLabHandler) IsEnabled() bool {
	return g.cfg.IsEnabled()
}

// GitLabLoginInitiate redirects the user to GitLab for OIDC login.
// It expects a "return_to" query parameter containing the URL to redirect to
// after successful authentication (typically the original /oauth2/authorize URL).
// A random state is generated and stored in an HTTP-only cookie for CSRF protection.
func (g *GitLabHandler) GitLabLoginInitiate(c *fiber.Ctx) error {
	if !g.cfg.IsEnabled() {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "gitlab login disabled"})
	}

	returnTo := c.Query("return_to")
	if returnTo == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request", "error_description": "return_to is required"})
	}

	// Generate cryptographically random state
	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error", "error_description": "failed to generate state"})
	}
	state := hex.EncodeToString(stateBytes)

	// Set HTTP-only state cookie for CSRF validation
	c.Cookie(&fiber.Cookie{
		Name:     StateCookieName,
		Value:    state,
		Path:     "/",
		HTTPOnly: true,
		Secure:   g.secureCookies,
		SameSite: fiber.CookieSameSiteLaxMode,
		MaxAge:   stateCookieMaxAge,
	})

	// Store the return_to URL in a cookie for use in the callback
	c.Cookie(&fiber.Cookie{
		Name:     ReturnToCookieName,
		Value:    returnTo,
		Path:     "/",
		HTTPOnly: true,
		Secure:   g.secureCookies,
		SameSite: fiber.CookieSameSiteLaxMode,
		MaxAge:   stateCookieMaxAge,
	})

	url := g.oauth2Config.AuthCodeURL(state)
	return c.Redirect(url, http.StatusTemporaryRedirect)
}

// GitLabLoginCallback handles the callback from GitLab.
// It validates the state parameter against the cookie, exchanges the code for
// a token, creates/finds the user, creates a session, and redirects to the
// return_to URL stored in the cookie.
func (g *GitLabHandler) GitLabLoginCallback(c *fiber.Ctx) error {
	if !g.cfg.IsEnabled() {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "gitlab login disabled"})
	}

	code := c.Query("code")
	if code == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request", "error_description": "no code provided"})
	}

	state := c.Query("state")
	if state == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request", "error_description": "no state provided"})
	}

	// Validate state against cookie
	cookieState := c.Cookies(StateCookieName)
	if cookieState == "" || cookieState != state {
		return c.Status(http.StatusForbidden).JSON(fiber.Map{"error": "invalid_state", "error_description": "state mismatch"})
	}

	// Read return_to from cookie
	returnTo := c.Cookies(ReturnToCookieName)
	if returnTo == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request", "error_description": "missing return_to"})
	}

	// Clear state and return_to cookies
	c.ClearCookie(StateCookieName)
	c.ClearCookie(ReturnToCookieName)

	ctx := c.Context()

	// Exchange code for token
	token, err := g.oauth2Config.Exchange(ctx, code)
	if err != nil {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "token_exchange_failed", "error_description": err.Error()})
	}

	// Fetch userinfo from GitLab
	userInfo, err := g.fetchGitLabUserInfo(ctx, token.AccessToken)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "userinfo_failed", "error_description": err.Error()})
	}

	// Find or create user
	user, err := g.findOrCreateUser(ctx, userInfo)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "user_provisioning_failed", "error_description": err.Error()})
	}

	// Create session and set session cookie
	sess, err := g.sessionMgr.CreateSession(ctx, user.ID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "session_failed", "error_description": err.Error()})
	}

	// Set session cookie via http.ResponseWriter
	sessionCookieAdapter := adaptor.HTTPHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		g.sessionMgr.SetSessionCookie(w, sess.Token)
		http.Redirect(w, r, returnTo, http.StatusTemporaryRedirect)
	}))
	return sessionCookieAdapter(c)
}

type gitlabUserInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	Username      string `json:"nickname"`
	Picture       string `json:"picture"`
	EmailVerified bool   `json:"email_verified"`
}

func (g *GitLabHandler) fetchGitLabUserInfo(ctx context.Context, accessToken string) (*gitlabUserInfo, error) {
	issuer := strings.TrimSuffix(g.cfg.GetIssuer(), "/")
	req, err := http.NewRequestWithContext(ctx, "GET", issuer+"/oauth/userinfo", nil)
	if err != nil {
		return nil, fmt.Errorf("creating userinfo request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching userinfo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("userinfo returned status %d: %s", resp.StatusCode, string(body))
	}

	var info gitlabUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("decoding userinfo: %w", err)
	}

	return &info, nil
}

func (g *GitLabHandler) findOrCreateUser(ctx context.Context, info *gitlabUserInfo) (*model.User, error) {
	// Try to find existing identity
	identity, err := g.identityRepo.GetByProvider(ctx, gitlabProviderName, info.Sub)
	if err == nil {
		// Existing user found
		return g.userRepo.GetByID(ctx, identity.UserID)
	}

	// Check if a user with the same email already exists
	user, err := g.userRepo.GetByEmail(ctx, info.Email)
	if err != nil {
		// User doesn't exist, create one
		var pictureURL sql.NullString
		if info.Picture != "" {
			pictureURL = sql.NullString{String: info.Picture, Valid: true}
		}
		user, err = g.userRepo.CreateWithPassword(ctx, repository.CreateUserWithPasswordParams{
			Email:      info.Email,
			Name:       info.Name,
			PictureURL: optional.From(pictureURL.String),
		})
		if err != nil {
			return nil, fmt.Errorf("creating user: %w", err)
		}

		// Audit the self-registration; the acting user is the new user.
		actx := authz.WithUser(ctx, user.ID.String(), nil)
		if err := g.audits.Record(actx, audit.Subject{
			ResourceName: "users/" + user.ID.String(),
			ResourceID:   user.ID,
		}, audit.ActionCreate, nil, user); err != nil {
			return nil, fmt.Errorf("auditing user creation: %w", err)
		}
	}

	// Create the identity link
	identity = &model.UserIdentity{
		CustomID:       info.Username,
		UserID:         user.ID,
		Provider:       gitlabProviderName,
		ProviderUserID: info.Sub,
	}
	if err := g.identityRepo.Create(ctx, identity); err != nil {
		return nil, fmt.Errorf("creating user identity: %w", err)
	}

	// Audit the identity link creation as part of user provisioning.
	actx := authz.WithUser(ctx, user.ID.String(), nil)
	if err := g.audits.RecordChanges(actx, audit.Subject{
		ResourceName: fmt.Sprintf("users/%s/identities/%s", user.ID, identity.CustomID),
		ResourceID:   identity.ID,
	}, audit.ActionCreate, []model.AuditLogEntryChange{
		{Field: "provider", NewValue: &identity.Provider},
		{Field: "provider_user_id", NewValue: &identity.ProviderUserID},
	}); err != nil {
		return nil, fmt.Errorf("auditing user identity creation: %w", err)
	}

	return user, nil
}
