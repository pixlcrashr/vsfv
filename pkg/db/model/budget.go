package model

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Budget struct {
	ID                       uuid.UUID    `gorm:"type:uuid;primaryKey;uniqueIndex:idx_budgets_org_id,priority:1"`
	CustomID                 string       `gorm:"uniqueIndex:idx_budgets_custom_id_org,priority:1"`
	OrganizationID           uuid.UUID    `gorm:"type:uuid;not null;uniqueIndex:idx_budgets_org_id,priority:2;uniqueIndex:idx_budgets_custom_id_org,priority:2;index:idx_budgets_org_order,priority:1"`
	DisplayName              string       `gorm:"not null;default:'';index:idx_budgets_display_name"`
	DisplayDescription       string       `gorm:"not null;default:''"`
	IsClosed                 bool         `gorm:"not null;default:false"`
	IsPublished              bool         `gorm:"not null;default:false"`
	PublishActualValues      bool         `gorm:"not null;default:false"`
	PublishActualValuesUntil sql.NullTime `gorm:"default:null"`
	PeriodStart              time.Time    `gorm:"not null"`
	PeriodEnd                time.Time    `gorm:"not null"`
	Order                    int32        `gorm:"column:sort_order;not null;default:0;index:idx_budgets_org_order,priority:2"`
	UpdatedAt                time.Time    `gorm:"not null;default:CURRENT_TIMESTAMP"`
	CreatedAt                time.Time    `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	Organization        Organization         `gorm:"foreignKey:OrganizationID"`
	BudgetRevisions     []BudgetRevision     `gorm:"foreignKey:BudgetID"`
	BudgetAccountValues []BudgetAccountValue `gorm:"foreignKey:BudgetID"`
}

func (Budget) TableName() string { return "budgets" }

func (m *Budget) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}

	if m.CustomID == "" {
		m.CustomID = m.ID.String()
	}

	return nil
}

func (m *Budget) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
