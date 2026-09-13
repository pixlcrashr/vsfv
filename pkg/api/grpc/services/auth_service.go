package services

import (
	"context"
	"errors"

	"github.com/pixlcrashr/vsfv/pkg/auth"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

var (
	statusLoginEmailRequired     = status.New(codes.InvalidArgument, "email is required")
	statusLoginPasswordRequired  = status.New(codes.InvalidArgument, "password is required")
	statusPasswordAuthDisabled   = status.New(codes.FailedPrecondition, "password authentication is disabled")
	statusInvalidLoginCredential = status.New(codes.Unauthenticated, "invalid email or password")
	statusFailedLogin            = status.New(codes.Internal, "failed to log in")
	statusFailedSetSession       = status.New(codes.Internal, "failed to create login session")
)

type authServiceServer struct {
	gen.UnimplementedAuthServiceServer
	passwordLogin *auth.PasswordLoginProvider
	gitlabEnabled bool
}

func newAuthServiceServer(passwordLogin *auth.PasswordLoginProvider, gitlabEnabled bool) *authServiceServer {
	return &authServiceServer{
		passwordLogin: passwordLogin,
		gitlabEnabled: gitlabEnabled,
	}
}

// Login verifies the credentials, creates the browser session cookie and
// returns the OAuth2 URL the client should follow to obtain its tokens.
// The session cookie is transmitted via the "set-cookie" response header,
// which the gateway forwards because the AuthService is registered on the
// public mux with a matching outgoing header matcher.
func (s *authServiceServer) Login(ctx context.Context, req *gen.LoginRequest) (*gen.LoginResponse, error) {
	if req.Email == "" {
		return nil, &ServerError{Status: statusLoginEmailRequired}
	}
	if req.Password == "" {
		return nil, &ServerError{Status: statusLoginPasswordRequired}
	}

	redirectURL, cookie, err := s.passwordLogin.Login(ctx, req.Email, req.Password)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrPasswordAuthDisabled):
			return nil, &ServerError{Err: err, Status: statusPasswordAuthDisabled}
		case errors.Is(err, auth.ErrInvalidCredentials):
			return nil, &ServerError{Err: err, Status: statusInvalidLoginCredential}
		default:
			return nil, &ServerError{Err: err, Status: statusFailedLogin}
		}
	}

	if err := grpc.SetHeader(ctx, metadata.Pairs("set-cookie", cookie)); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedSetSession}
	}

	return &gen.LoginResponse{RedirectUrl: redirectURL}, nil
}

func (s *authServiceServer) GetLoginOptions(ctx context.Context, req *gen.GetLoginOptionsRequest) (*gen.LoginOptions, error) {
	return &gen.LoginOptions{
		PasswordEnabled: s.passwordLogin.Enabled(),
		GitlabEnabled:   s.gitlabEnabled,
	}, nil
}
