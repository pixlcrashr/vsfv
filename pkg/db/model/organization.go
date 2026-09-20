package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Organization struct {
	ID                 uuid.UUID  `gorm:"type:uuid;primaryKey"`
	CustomID           string     `gorm:"uniqueIndex:idx_organizations_custom_id"`
	DisplayName        string     `gorm:"not null;default:''"`
	DisplayDescription string     `gorm:"not null;default:''"`
	StartMonth         time.Month `gorm:"type:int;not null;default:1"`
	UpdatedAt          time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP"`
	CreatedAt          time.Time  `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	AccountGroupAssignments     []AccountGroupAssignment        `gorm:"foreignKey:OrganizationID"`
	AccountGroups               []AccountGroup                  `gorm:"foreignKey:OrganizationID"`
	Accounts                    []Account                       `gorm:"foreignKey:OrganizationID"`
	BudgetRevisions             []BudgetRevision                `gorm:"foreignKey:OrganizationID"`
	BudgetRevisionAccountValues []BudgetRevisionAccountValue    `gorm:"foreignKey:OrganizationID"`
	BudgetAccountValues         []BudgetAccountValue            `gorm:"foreignKey:OrganizationID"`
	Budgets                     []Budget                        `gorm:"foreignKey:OrganizationID"`
	LedgerYears                 []LedgerYear                    `gorm:"foreignKey:OrganizationID"`
	LedgerAccounts              []LedgerAccount                 `gorm:"foreignKey:OrganizationID"`
	ReportTemplates             []ReportTemplate                `gorm:"foreignKey:OrganizationID"`
	Reports                     []Report                        `gorm:"foreignKey:OrganizationID"`
	Transactions                []Transaction_                  `gorm:"foreignKey:OrganizationID"`
	TransactionAssignments      []TransactionAssignment         `gorm:"foreignKey:OrganizationID"`
	Committees                  []Committee                     `gorm:"foreignKey:OrganizationID"`
	Submissions                 []Submission                    `gorm:"foreignKey:OrganizationID"`
	SubmissionSettings          *OrganizationSubmissionSettings `gorm:"foreignKey:OrganizationID"`
}

func (Organization) TableName() string { return "organizations" }

func (m *Organization) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}

	if m.CustomID == "" {
		m.CustomID = m.ID.String()
	}

	return nil
}

func (m *Organization) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
