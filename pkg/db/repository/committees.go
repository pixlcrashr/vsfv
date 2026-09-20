package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/model/dao"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"gorm.io/gorm"
)

var (
	ErrCommitteeNotFound      = errors.New("committee not found")
	ErrCommitteeAlreadyExists = errors.New("committee already exists")
)

// CommitteeOrderFieldMapper maps API order_by field names to database column names.
var CommitteeOrderFieldMapper = order.FieldMapper{
	"displayName": "display_name",
	"createTime":  "created_at",
	"updateTime":  "updated_at",
}

// ListCommitteesParams drives the List query.
type ListCommitteesParams struct {
	// Cond is an optional abstract condition chain.
	Cond cond.Cond
	// OrderBy specifies the sort field and direction as SQL expressions.
	OrderBy []order.Expr
	// Page number (1-indexed).
	Page int
	// PageSize caps the number of rows returned.
	PageSize int
}

// committeeColumnMapper maps filter field names to database column names.
func committeeColumnMapper(field string) (string, bool) {
	switch field {
	case "display_name":
		return "display_name", true
	default:
		return "", false
	}
}

// CommitteeRepository provides CRUD for the committees table.
type CommitteeRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewCommitteeRepository creates a CommitteeRepository backed by db.
func NewCommitteeRepository(db *gorm.DB) *CommitteeRepository {
	return &CommitteeRepository{db: db, q: dao.Use(db)}
}

// List returns committees matching params along with the total count.
// Payment accounts are preloaded for each committee.
func (r *CommitteeRepository) List(ctx context.Context, params ListCommitteesParams) ([]*model.Committee, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	db := r.db.WithContext(ctx).Model(&model.Committee{})

	db = cond.Apply(db, params.Cond, committeeColumnMapper)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count committees page=%d: %w", params.Page, err)
	}

	if len(params.OrderBy) > 0 {
		for _, expr := range params.OrderBy {
			db = db.Order(expr.String())
		}
	} else {
		db = db.Order("display_name ASC, id ASC")
	}

	offset := (params.Page - 1) * params.PageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(params.PageSize)

	var ms []*model.Committee
	if err := db.Preload("PaymentAccounts").Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list committees page=%d: %w", params.Page, err)
	}

	return ms, total, nil
}

// GetByID returns the committee with the given ID including its payment
// accounts.
func (r *CommitteeRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Committee, error) {
	m, err := r.q.Committee.WithContext(ctx).
		Preload(r.q.Committee.PaymentAccounts).
		Where(r.q.Committee.ID.Eq(id)).
		First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrCommitteeNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get committee id=%s: %w", id, err)
	}
	return m, nil
}

// GetByCustomID returns the committee with the given custom ID within an
// organization, including its payment accounts.
func (r *CommitteeRepository) GetByCustomID(ctx context.Context, orgID uuid.UUID, customID string) (*model.Committee, error) {
	m, err := r.q.Committee.WithContext(ctx).
		Preload(r.q.Committee.PaymentAccounts).
		Where(
			r.q.Committee.OrganizationID.Eq(orgID),
			r.q.Committee.CustomID.Eq(customID),
		).
		First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrCommitteeNotFound, fmt.Errorf("organization_id=%s custom_id=%s: %w", orgID, customID, err))
		}
		return nil, fmt.Errorf("get committee organization_id=%s custom_id=%s: %w", orgID, customID, err)
	}
	return m, nil
}

// CreateCommitteeParams holds the fields required to create a committee.
type CreateCommitteeParams struct {
	OrganizationID      uuid.UUID
	DisplayName         string
	DisplayDescription  string
	AllowScopeSelection bool
	CustomID            string
	PaymentAccounts     []model.CommitteePaymentAccount
}

// Create inserts a new committee together with its payment accounts.
func (r *CommitteeRepository) Create(ctx context.Context, params CreateCommitteeParams) (*model.Committee, error) {
	m := &model.Committee{
		OrganizationID:      params.OrganizationID,
		DisplayName:         params.DisplayName,
		DisplayDescription:  params.DisplayDescription,
		AllowScopeSelection: params.AllowScopeSelection,
		CustomID:            params.CustomID,
		PaymentAccounts:     params.PaymentAccounts,
	}

	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, errors.Join(ErrCommitteeAlreadyExists, fmt.Errorf("custom_id=%s: %w", m.CustomID, err))
		}
		return nil, fmt.Errorf("create committee custom_id=%s: %w", m.CustomID, err)
	}
	return m, nil
}

// UpdateCommitteeParams holds the fields that can be updated for a committee.
type UpdateCommitteeParams struct {
	DisplayName         optional.Optional[string]
	DisplayDescription  optional.Optional[string]
	AllowScopeSelection optional.Optional[bool]
}

// Update updates scalar fields of an existing committee matched by its primary
// key. Payment accounts are managed separately via ReplacePaymentAccounts.
func (r *CommitteeRepository) Update(ctx context.Context, id uuid.UUID, params UpdateCommitteeParams) error {
	sets := map[string]any{}

	if params.DisplayName.IsSet {
		sets["display_name"] = params.DisplayName.Value
	}
	if params.DisplayDescription.IsSet {
		sets["display_description"] = params.DisplayDescription.Value
	}
	if params.AllowScopeSelection.IsSet {
		sets["allow_scope_selection"] = params.AllowScopeSelection.Value
	}

	if len(sets) == 0 {
		return nil
	}

	if err := r.db.WithContext(ctx).Model(&model.Committee{}).Where("id = ?", id).Updates(sets).Error; err != nil {
		return fmt.Errorf("update committee id=%s: %w", id, err)
	}
	return nil
}

// ReplacePaymentAccounts replaces the payment accounts of a committee.
// Accounts with an existing ID keep that ID (so submission references stay
// valid); accounts without an ID are created; accounts missing from the input
// are removed.
func (r *CommitteeRepository) ReplacePaymentAccounts(ctx context.Context, committeeID uuid.UUID, accounts []model.CommitteePaymentAccount) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing []model.CommitteePaymentAccount
		if err := tx.Where("committee_id = ?", committeeID).Find(&existing).Error; err != nil {
			return fmt.Errorf("load payment accounts committee_id=%s: %w", committeeID, err)
		}

		keep := make(map[uuid.UUID]bool, len(accounts))
		for i := range accounts {
			a := &accounts[i]
			a.CommitteeID = committeeID
			if a.ID != uuid.Nil {
				keep[a.ID] = true
				if err := tx.Omit("CreatedAt").Save(a).Error; err != nil {
					return fmt.Errorf("update payment account id=%s: %w", a.ID, err)
				}
			}
		}

		for _, e := range existing {
			if !keep[e.ID] {
				if err := tx.Delete(&model.CommitteePaymentAccount{}, e.ID).Error; err != nil {
					return fmt.Errorf("delete payment account id=%s: %w", e.ID, err)
				}
			}
		}

		for i := range accounts {
			if accounts[i].ID == uuid.Nil {
				accounts[i].CommitteeID = committeeID
				if err := tx.Create(&accounts[i]).Error; err != nil {
					return fmt.Errorf("create payment account: %w", err)
				}
			}
		}

		return nil
	})
}

// Delete removes the committee with the given ID together with its payment
// accounts. It fails if the committee is still referenced by submissions
// (checked by the service via CountSubmissionsByCommittee).
func (r *CommitteeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("committee_id = ?", id).Delete(&model.CommitteePaymentAccount{}).Error; err != nil {
			return fmt.Errorf("delete committee payment accounts id=%s: %w", id, err)
		}
		result := tx.Delete(&model.Committee{}, id)
		if result.Error != nil {
			return fmt.Errorf("delete committee id=%s: %w", id, result.Error)
		}
		if result.RowsAffected == 0 {
			return errors.Join(ErrCommitteeNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
		}
		return nil
	})
}
