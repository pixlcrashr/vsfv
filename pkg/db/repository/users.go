package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/model/dao"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound = errors.New("user not found")
)

var UserOrderFieldMapper = order.FieldMapper{
	"displayName": "name",
	"email":       "email",
	"createTime":  "created_at",
	"updateTime":  "updated_at",
}

type ListUsersParams struct {
	Cond     cond.Cond
	OrderBy  []order.Expr
	Page     int
	PageSize int
}

func userColumnMapper(field string) (string, bool) {
	switch field {
	case "display_name":
		return "name", true
	case "email":
		return "email", true
	case "is_active":
		return "1", true // all users are active for now
	default:
		return "", false
	}
}

type UserRepository struct {
	db *gorm.DB
	q  *dao.Query
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db, q: dao.Use(db)}
}

func (r *UserRepository) List(ctx context.Context, params ListUsersParams) ([]*model.User, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	base := r.db.WithContext(ctx).Table("users")

	db := base
	if params.Cond != nil && !params.Cond.IsEmpty() {
		db = cond.Apply(db, params.Cond, userColumnMapper)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count users: %w", err)
	}

	if len(params.OrderBy) > 0 {
		for _, expr := range params.OrderBy {
			db = db.Order(expr.String())
		}
	} else {
		db = db.Order("name ASC")
	}

	offset := (params.Page - 1) * params.PageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(params.PageSize)

	var ms []*model.User
	if err := db.Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list users: %w", err)
	}

	return ms, total, nil
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	m, err := r.q.User.WithContext(ctx).Where(r.q.User.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrUserNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get user id=%s: %w", id, err)
	}
	return m, nil
}

// GetByIDs returns the users with the given IDs. IDs without a matching user
// are silently omitted; the caller decides how to handle missing users.
func (r *UserRepository) GetByIDs(ctx context.Context, ids []uuid.UUID) ([]*model.User, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var ms []*model.User
	if err := r.db.WithContext(ctx).Where("id IN ?", ids).Find(&ms).Error; err != nil {
		return nil, fmt.Errorf("get users by ids: %w", err)
	}
	return ms, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	m, err := r.q.User.WithContext(ctx).Where(r.q.User.Email.Eq(email)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrUserNotFound, fmt.Errorf("email=%s: %w", email, err))
		}
		return nil, fmt.Errorf("get user email=%s: %w", email, err)
	}
	return m, nil
}

func (r *UserRepository) GetByName(ctx context.Context, name string, isCaseInsensitive bool) (*model.User, error) {
	var m *model.User
	var err error
	if isCaseInsensitive {
		err = r.db.WithContext(ctx).Where("LOWER(name) = LOWER(?)", name).First(&m).Error
	} else {
		m, err = r.q.User.WithContext(ctx).Where(r.q.User.Name.Eq(name)).First()
	}
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrUserNotFound, fmt.Errorf("name=%s: %w", name, err))
		}
		return nil, fmt.Errorf("get user name=%s: %w", name, err)
	}
	return m, nil
}

type CreateUserWithPasswordParams struct {
	Email      string
	Name       string
	Password   string
	PictureURL optional.Optional[string]
}

func (r *UserRepository) CreateWithPassword(ctx context.Context, params CreateUserWithPasswordParams) (*model.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(params.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	m := &model.User{
		Email:        params.Email,
		Name:         params.Name,
		PasswordHash: sql.NullString{String: string(hash), Valid: true},
	}
	if params.PictureURL.IsSet {
		m.PictureURL = sql.NullString{String: params.PictureURL.Value, Valid: true}
	}
	if err := r.q.User.WithContext(ctx).Create(m); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, fmt.Errorf("create user email=%s: already exists: %w", params.Email, err)
		}
		return nil, fmt.Errorf("create user: %w", err)
	}
	return m, nil
}
