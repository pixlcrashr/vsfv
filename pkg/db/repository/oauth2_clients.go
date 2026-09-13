package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/model/dao"
	"github.com/pixlcrashr/vsfv/pkg/db/types"
	"gorm.io/gorm"
)

var (
	ErrOAuth2ClientNotFound      = errors.New("oauth2 client not found")
	ErrOAuth2ClientAlreadyExists = errors.New("oauth2 client already exists")
)

type OAuth2ClientRepository struct {
	db *gorm.DB
	q  *dao.Query
}

func NewOAuth2ClientRepository(db *gorm.DB) *OAuth2ClientRepository {
	return &OAuth2ClientRepository{db: db, q: dao.Use(db)}
}

func (r *OAuth2ClientRepository) GetByClientID(ctx context.Context, clientID string) (*model.OAuth2Client, error) {
	m, err := r.q.OAuth2Client.WithContext(ctx).Where(r.q.OAuth2Client.ClientID.Eq(clientID)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrOAuth2ClientNotFound, fmt.Errorf("client_id=%s: %w", clientID, err))
		}
		return nil, fmt.Errorf("get oauth2 client client_id=%s: %w", clientID, err)
	}
	return m, nil
}

func (r *OAuth2ClientRepository) List(ctx context.Context) ([]*model.OAuth2Client, error) {
	ms, err := r.q.OAuth2Client.WithContext(ctx).Order(r.q.OAuth2Client.CreatedAt.Desc()).Find()
	if err != nil {
		return nil, fmt.Errorf("list oauth2 clients: %w", err)
	}
	return ms, nil
}

type CreateOAuth2ClientParams struct {
	ClientID                string
	ClientName              string
	ClientSecret            sql.NullString
	RedirectURIs            types.StringArray
	GrantTypes              types.StringArray
	ResponseTypes           types.StringArray
	Scopes                  types.StringArray
	TokenEndpointAuthMethod string
	UserID                  sql.Null[uuid.UUID]
	Public                  bool
}

func (r *OAuth2ClientRepository) Create(ctx context.Context, params CreateOAuth2ClientParams) (*model.OAuth2Client, error) {
	m := &model.OAuth2Client{
		ClientID:                params.ClientID,
		ClientName:              params.ClientName,
		ClientSecret:            params.ClientSecret,
		RedirectURIs:            params.RedirectURIs,
		GrantTypes:              params.GrantTypes,
		ResponseTypes:           params.ResponseTypes,
		Scopes:                  params.Scopes,
		TokenEndpointAuthMethod: params.TokenEndpointAuthMethod,
		UserID:                  params.UserID,
		Public:                  params.Public,
	}
	if err := r.q.OAuth2Client.WithContext(ctx).Create(m); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, errors.Join(ErrOAuth2ClientAlreadyExists, fmt.Errorf("client_id=%s: %w", m.ClientID, err))
		}
		return nil, fmt.Errorf("create oauth2 client: %w", err)
	}
	return m, nil
}

// UpdateScopes replaces the scope list of the client with the given one.
func (r *OAuth2ClientRepository) UpdateScopes(ctx context.Context, clientID string, scopes types.StringArray) error {
	_, err := r.q.OAuth2Client.WithContext(ctx).
		Where(r.q.OAuth2Client.ClientID.Eq(clientID)).
		Update(r.q.OAuth2Client.Scopes, scopes)
	if err != nil {
		return fmt.Errorf("update oauth2 client scopes client_id=%s: %w", clientID, err)
	}
	return nil
}
