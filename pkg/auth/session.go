package auth

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

const SessionCookieName = "vsfv_session"

type SessionManager struct {
	repo          *repository.AuthSessionRepository
	ttl           time.Duration
	secureCookies bool
}

func NewSessionManager(repo *repository.AuthSessionRepository, ttl time.Duration, secureCookies bool) *SessionManager {
	return &SessionManager{repo: repo, ttl: ttl, secureCookies: secureCookies}
}

func (sm *SessionManager) CreateSession(ctx context.Context, userID uuid.UUID) (*model.AuthSession, error) {
	return sm.repo.Create(ctx, userID, sm.ttl)
}

func (sm *SessionManager) GetSession(ctx context.Context, token string) (*model.AuthSession, error) {
	sess, err := sm.repo.GetByToken(ctx, token)
	if err != nil {
		return nil, err
	}
	if time.Now().UTC().After(sess.ExpiresAt) {
		_ = sm.repo.DeleteByToken(ctx, token)
		return nil, errors.New("session expired")
	}
	return sess, nil
}

func (sm *SessionManager) DeleteSession(ctx context.Context, token string) error {
	return sm.repo.DeleteByToken(ctx, token)
}

func (sm *SessionManager) sessionCookie(token string) *http.Cookie {
	return &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   sm.secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sm.ttl.Seconds()),
	}
}

// SetSessionCookie sets the session cookie on the given response writer.
func (sm *SessionManager) SetSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, sm.sessionCookie(token))
}

// SessionCookieString returns the Set-Cookie header value for a session
// cookie with the given token. For handlers that cannot use http.SetCookie,
// e.g. gRPC services whose cookie must be forwarded through response
// metadata.
func (sm *SessionManager) SessionCookieString(token string) string {
	return sm.sessionCookie(token).String()
}

func (sm *SessionManager) ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   sm.secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func (sm *SessionManager) GetSessionFromRequest(ctx context.Context, r *http.Request) (*model.AuthSession, error) {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		return nil, errors.New("no session cookie")
	}
	return sm.GetSession(ctx, cookie.Value)
}
