package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/model/dao"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"gorm.io/gen/field"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrOrganizationNotFound      = errors.New("organization not found")
	ErrOrganizationAlreadyExists = errors.New("organization already exists")
)

// OrganizationOrderFieldMapper maps API order_by field names to database column names.
var OrganizationOrderFieldMapper = order.FieldMapper{
	"displayName": "display_name",
	"createTime":  "created_at",
	"updateTime":  "updated_at",
}

// ListOrganizationsParams drives the List query.
type ListOrganizationsParams struct {
	// Cond is an optional abstract condition chain.
	Cond cond.Cond
	// OrderBy specifies the sort field and direction as SQL expressions.
	OrderBy []order.Expr
	// Page number (1-indexed).
	Page int
	// PageSize caps the number of rows returned.
	PageSize int
}

// organizationColumnMapper maps filter field names to database column names.
func organizationColumnMapper(field string) (string, bool) {
	switch field {
	case "display_name":
		return "display_name", true
	default:
		return "", false
	}
}

// OrganizationRepository provides CRUD and list queries for the organizations table.
type OrganizationRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewOrganizationRepository creates an OrganizationRepository backed by db.
func NewOrganizationRepository(db *gorm.DB) *OrganizationRepository {
	return &OrganizationRepository{db: db, q: dao.Use(db)}
}

func (r *OrganizationRepository) GetByResourceName(ctx context.Context, organization string) (*model.Organization, error) {
	var orgID uuid.UUID
	orgID, _ = uuid.Parse(organization)

	o, err := r.q.Organization.WithContext(ctx).Where(
		field.Or(
			r.q.Organization.CustomID.Eq(organization),
			r.q.Organization.ID.Eq(orgID),
		),
	).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrOrganizationNotFound, fmt.Errorf("organization=%s: %w", organization, err))
		}
		return nil, fmt.Errorf("get organization organization=%s: %w", organization, err)
	}

	return o, nil
}

// List returns organizations matching params along with the total count.
func (r *OrganizationRepository) List(ctx context.Context, params ListOrganizationsParams) ([]*model.Organization, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	db := r.db.WithContext(ctx).Table("organizations")

	db = cond.Apply(db, params.Cond, organizationColumnMapper)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count organizations page=%d: %w", params.Page, err)
	}

	if len(params.OrderBy) > 0 {
		for _, expr := range params.OrderBy {
			db = db.Order(expr.String())
		}
	} else {
		db = db.Order("created_at DESC")
	}

	offset := (params.Page - 1) * params.PageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(params.PageSize)

	var ms []*model.Organization
	if err := db.Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list organizations page=%d: %w", params.Page, err)
	}

	return ms, total, nil
}

// GetByID returns the organization with the given ID.
func (r *OrganizationRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Organization, error) {
	m, err := r.q.Organization.WithContext(ctx).Where(r.q.Organization.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrOrganizationNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get organization id=%s: %w", id, err)
	}
	return m, nil
}

// ExistsByCustomID reports whether an organization with the given custom ID exists.
func (r *OrganizationRepository) ExistsByCustomID(ctx context.Context, customID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.Organization{}).
		Where("custom_id = ?", customID).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("check organization exists custom_id=%s: %w", customID, err)
	}
	return count > 0, nil
}

// CreateOrganizationParams holds the fields required to create an organization.
type CreateOrganizationParams struct {
	DisplayName        string
	DisplayDescription string
	StartMonth         time.Month
	CustomID           string
}

// Create inserts a new organization.
func (r *OrganizationRepository) Create(ctx context.Context, params CreateOrganizationParams) (*model.Organization, error) {
	m := &model.Organization{
		DisplayName:        params.DisplayName,
		DisplayDescription: params.DisplayDescription,
		StartMonth:         params.StartMonth,
		CustomID:           params.CustomID,
	}
	if err := r.q.Organization.WithContext(ctx).Create(m); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, errors.Join(ErrOrganizationAlreadyExists, fmt.Errorf("custom_id=%s: %w", m.CustomID, err))
		}
		return nil, fmt.Errorf("create organization custom_id=%s: %w", m.CustomID, err)
	}
	return m, nil
}

// UpdateOrganizationParams holds the fields that can be updated for an organization.
type UpdateOrganizationParams struct {
	DisplayName        optional.Optional[string]
	DisplayDescription optional.Optional[string]
	StartMonth         optional.Optional[time.Month]
	CustomID           optional.Optional[string]
}

// Update updates fields of an existing organization matched by its primary key.
func (r *OrganizationRepository) Update(ctx context.Context, id uuid.UUID, params UpdateOrganizationParams) error {
	var cols []field.AssignExpr

	if params.DisplayName.IsSet {
		cols = append(cols, r.q.Organization.DisplayName.Value(params.DisplayName.Value))
	}

	if params.DisplayDescription.IsSet {
		cols = append(cols, r.q.Organization.DisplayDescription.Value(params.DisplayDescription.Value))
	}

	if params.StartMonth.IsSet {
		cols = append(cols, r.q.Organization.StartMonth.Value(int(params.StartMonth.Value)))
	}

	if params.CustomID.IsSet {
		cols = append(cols, r.q.Organization.CustomID.Value(params.CustomID.Value))
	}

	if len(cols) == 0 {
		return nil
	}

	if _, err := r.q.Organization.WithContext(ctx).Where(r.q.Organization.ID.Eq(id)).UpdateSimple(cols...); err != nil {
		return fmt.Errorf("update organization id=%s: %w", id, err)
	}

	return nil
}

// Delete removes the organization with the given ID and all associated data.
// The caller is responsible for the surrounding transaction.
func (r *OrganizationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	db := r.db.WithContext(ctx)
	var count int64
	if err := db.Model(&model.Organization{}).Where("id = ?", id).Count(&count).Error; err != nil {
		return fmt.Errorf("check organization id=%s: %w", id, err)
	}
	if count == 0 {
		return errors.Join(ErrOrganizationNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}

	// Break account self-references so GORM's association cascade can delete
	// the account hierarchy without violating the parent_account_id FK.
	if err := db.Model(&model.Account{}).Where("organization_id = ?", id).Update("parent_account_id", nil).Error; err != nil {
		return fmt.Errorf("clear account parents for organization id=%s: %w", id, err)
	}

	if err := db.Select(clause.Associations).Delete(&model.Organization{ID: id}).Error; err != nil {
		return fmt.Errorf("delete organization id=%s: %w", id, err)
	}
	return nil
}
