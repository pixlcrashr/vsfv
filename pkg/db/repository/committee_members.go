package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/model/dao"
	"gorm.io/gorm"
)

var (
	ErrCommitteeMemberNotFound      = errors.New("committee member not found")
	ErrCommitteeMemberAlreadyExists = errors.New("committee member already exists")
)

// CommitteeMemberRepository provides CRUD for the committee_members table.
type CommitteeMemberRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewCommitteeMemberRepository creates a CommitteeMemberRepository backed by db.
func NewCommitteeMemberRepository(db *gorm.DB) *CommitteeMemberRepository {
	return &CommitteeMemberRepository{db: db, q: dao.Use(db)}
}

// List returns the memberships of a committee (with the assigned users
// preloaded), newest first, along with the total count.
func (r *CommitteeMemberRepository) List(ctx context.Context, committeeID uuid.UUID, page, pageSize int) ([]*model.CommitteeMember, int64, error) {
	if pageSize <= 0 {
		pageSize = 20
	}
	if page <= 0 {
		page = 1
	}

	db := r.db.WithContext(ctx).Model(&model.CommitteeMember{}).
		Where("committee_id = ?", committeeID)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count committee members committee_id=%s: %w", committeeID, err)
	}

	offset := (page - 1) * pageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(pageSize)

	var ms []*model.CommitteeMember
	if err := db.
		Preload("User").
		Order("created_at DESC, id ASC").
		Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list committee members committee_id=%s: %w", committeeID, err)
	}

	return ms, total, nil
}

// GetByID returns the membership with the given ID (with the assigned user
// preloaded) within a committee.
func (r *CommitteeMemberRepository) GetByID(ctx context.Context, committeeID, id uuid.UUID) (*model.CommitteeMember, error) {
	m, err := r.q.CommitteeMember.WithContext(ctx).
		Preload(r.q.CommitteeMember.User).
		Where(
			r.q.CommitteeMember.ID.Eq(id),
			r.q.CommitteeMember.CommitteeID.Eq(committeeID),
		).
		First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrCommitteeMemberNotFound, fmt.Errorf("id=%s committee_id=%s: %w", id, committeeID, err))
		}
		return nil, fmt.Errorf("get committee member id=%s committee_id=%s: %w", id, committeeID, err)
	}
	return m, nil
}

// Create assigns a user to a committee. Fails with
// ErrCommitteeMemberAlreadyExists when the user is already a member.
func (r *CommitteeMemberRepository) Create(ctx context.Context, committeeID, userID uuid.UUID) (*model.CommitteeMember, error) {
	m := &model.CommitteeMember{
		CommitteeID: committeeID,
		UserID:      userID,
	}

	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, errors.Join(ErrCommitteeMemberAlreadyExists, fmt.Errorf("committee_id=%s user_id=%s: %w", committeeID, userID, err))
		}
		return nil, fmt.Errorf("create committee member committee_id=%s user_id=%s: %w", committeeID, userID, err)
	}
	return m, nil
}

// Delete removes the membership with the given ID within a committee.
func (r *CommitteeMemberRepository) Delete(ctx context.Context, committeeID, id uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("committee_id = ?", committeeID).
		Delete(&model.CommitteeMember{}, id)
	if result.Error != nil {
		return fmt.Errorf("delete committee member id=%s committee_id=%s: %w", id, committeeID, result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrCommitteeMemberNotFound, fmt.Errorf("id=%s committee_id=%s: %w", id, committeeID, gorm.ErrRecordNotFound))
	}
	return nil
}

// ListCommitteesByUserAndOrganization returns the committees of an
// organization the given user is a member of (with payment accounts
// preloaded), ordered by display name, along with the total count.
func (r *CommitteeMemberRepository) ListCommitteesByUserAndOrganization(ctx context.Context, orgID, userID uuid.UUID, page, pageSize int) ([]*model.Committee, int64, error) {
	if pageSize <= 0 {
		pageSize = 20
	}
	if page <= 0 {
		page = 1
	}

	db := r.db.WithContext(ctx).Model(&model.Committee{}).
		Joins("JOIN committee_members ON committee_members.committee_id = committees.id").
		Where("committee_members.user_id = ?", userID).
		Where("committees.organization_id = ?", orgID)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count committees user_id=%s organization_id=%s: %w", userID, orgID, err)
	}

	offset := (page - 1) * pageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(pageSize)

	var cs []*model.Committee
	if err := db.
		Preload("PaymentAccounts").
		Order("committees.display_name ASC, committees.id ASC").
		Find(&cs).Error; err != nil {
		return nil, 0, fmt.Errorf("list committees user_id=%s organization_id=%s: %w", userID, orgID, err)
	}

	return cs, total, nil
}
