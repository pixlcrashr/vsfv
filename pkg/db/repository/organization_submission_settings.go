package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"gorm.io/gorm"
)

// OrganizationSubmissionSettingsRepository provides access to the per-
// organization submission settings. A missing row yields default settings.
type OrganizationSubmissionSettingsRepository struct {
	db *gorm.DB
}

// NewOrganizationSubmissionSettingsRepository creates a repository backed by db.
func NewOrganizationSubmissionSettingsRepository(db *gorm.DB) *OrganizationSubmissionSettingsRepository {
	return &OrganizationSubmissionSettingsRepository{db: db}
}

// DefaultSettings returns the default submission settings (all settlement
// kinds enabled via empty list, no deadline).
func DefaultSettings(orgID uuid.UUID) *model.OrganizationSubmissionSettings {
	return &model.OrganizationSubmissionSettings{
		OrganizationID:         orgID,
		EnabledSettlementKinds: nil,
		SubmissionDeadline:     nil,
	}
}

// GetOrDefault returns the settings for the organization; if no row exists,
// default settings are returned instead.
func (r *OrganizationSubmissionSettingsRepository) GetOrDefault(ctx context.Context, orgID uuid.UUID) (*model.OrganizationSubmissionSettings, error) {
	var m model.OrganizationSubmissionSettings
	err := r.db.WithContext(ctx).Where("organization_id = ?", orgID).First(&m).Error
	if err == nil {
		return &m, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("get submission settings organization_id=%s: %w", orgID, err)
	}
	return DefaultSettings(orgID), nil
}

// Upsert creates or replaces the settings for the organization. A nil kinds
// slice means "all settlement kinds enabled"; a nil deadline means "no
// deadline".
func (r *OrganizationSubmissionSettingsRepository) Upsert(ctx context.Context, orgID uuid.UUID, kinds []string, deadline *time.Time) (*model.OrganizationSubmissionSettings, error) {
	var m model.OrganizationSubmissionSettings
	err := r.db.WithContext(ctx).Where("organization_id = ?", orgID).First(&m).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("upsert submission settings lookup organization_id=%s: %w", orgID, err)
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		m = model.OrganizationSubmissionSettings{
			OrganizationID:         orgID,
			EnabledSettlementKinds: kinds,
			SubmissionDeadline:     deadline,
		}
		if err := r.db.WithContext(ctx).Create(&m).Error; err != nil {
			return nil, fmt.Errorf("create submission settings organization_id=%s: %w", orgID, err)
		}
		return &m, nil
	}

	m.EnabledSettlementKinds = kinds
	m.SubmissionDeadline = deadline
	if err := r.db.WithContext(ctx).Save(&m).Error; err != nil {
		return nil, fmt.Errorf("update submission settings organization_id=%s: %w", orgID, err)
	}
	return &m, nil
}
