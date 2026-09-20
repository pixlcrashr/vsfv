package model

import (
	"time"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Direction mirrors the proto Direction enum.
type Direction int

const (
	DirectionUnspecified Direction = iota
	DirectionExpense
	DirectionIncome
)

// Settlement mirrors the proto Settlement enum.
type Settlement int

const (
	SettlementUnspecified Settlement = iota
	SettlementPerson
	SettlementCommitteeAccount
	SettlementPaymentRequest
)

// Scope mirrors the proto Scope enum.
type Scope int

const (
	ScopeUnspecified Scope = iota
	ScopeNonprofit
	ScopeCommercial
)

// SubmissionStatus mirrors the proto SubmissionStatus enum.
type SubmissionStatus int

const (
	SubmissionStatusUnspecified SubmissionStatus = iota
	SubmissionStatusDraft
	SubmissionStatusPending
	SubmissionStatusFurtherInfoRequired
	SubmissionStatusRejected
	SubmissionStatusApproved
	SubmissionStatusCompleted
)

// PayoutMethod mirrors the proto PayoutMethod enum.
type PayoutMethod int

const (
	PayoutMethodUnspecified PayoutMethod = iota
	PayoutMethodBankTransfer
	PayoutMethodCash
)

// PaymentRequestTiming mirrors the proto PaymentRequestTiming enum.
type PaymentRequestTiming int

const (
	PaymentRequestTimingUnspecified PaymentRequestTiming = iota
	PaymentRequestTimingOnInvoice
	PaymentRequestTimingAdvance
)

// Submission is a documented expense or income with receipts, submitted by a
// committee member and reviewed by the treasury.
//
// The settlement variant (Settlement) determines which of the settlement
// detail column groups is meaningful; there is no separate discriminator
// column.
type Submission struct {
	ID              uuid.UUID        `gorm:"type:uuid;primaryKey;uniqueIndex:idx_submissions_org_id,priority:1"`
	CustomID        string           `gorm:"not null;uniqueIndex:idx_submissions_org_custom_id,priority:1"`
	PublicID        string           `gorm:"not null;default:'';uniqueIndex:idx_submissions_org_public_id,priority:2"`
	OrganizationID  uuid.UUID        `gorm:"type:uuid;not null;uniqueIndex:idx_submissions_org_id,priority:2;uniqueIndex:idx_submissions_org_custom_id,priority:2;uniqueIndex:idx_submissions_org_public_id,priority:1"`
	CreatedByUserID uuid.UUID        `gorm:"type:uuid;not null;index:idx_submissions_created_by"`
	CommitteeID     uuid.UUID        `gorm:"type:uuid;not null;index:idx_submissions_committee"`
	Direction       Direction        `gorm:"type:int;not null;default:0"`
	Settlement      Settlement       `gorm:"type:int;not null;default:0"`
	Scope           Scope            `gorm:"type:int;not null;default:0"`
	Status          SubmissionStatus `gorm:"type:int;not null;default:0;index:idx_submissions_status"`
	Notice          string           `gorm:"not null;default:''"`
	TotalAmount     apd.Decimal      `gorm:"type:decimal;not null"`
	Etag            string           `gorm:"not null;default:''"`

	// Person settlement details (Settlement == SettlementPerson).
	PayoutMethod      PayoutMethod `gorm:"type:int;not null;default:0"`
	BankAccountHolder string       `gorm:"not null;default:''"`
	BankIban          string       `gorm:"not null;default:''"`
	BankBic           string       `gorm:"not null;default:''"`

	// Committee account settlement details (Settlement == SettlementCommitteeAccount).
	PaymentAccountUID       uuid.NullUUID `gorm:"type:uuid"`
	PaymentAccountLabel     string        `gorm:"not null;default:''"`
	AccountPaidDate         *time.Time    `gorm:"type:date"`
	AccountPaymentReference string        `gorm:"not null;default:''"`

	// Payment request settlement details (Settlement == SettlementPaymentRequest).
	VendorName   string               `gorm:"not null;default:''"`
	VendorIban   string               `gorm:"not null;default:''"`
	VendorBic    string               `gorm:"not null;default:''"`
	VendorTiming PaymentRequestTiming `gorm:"type:int;not null;default:0"`

	// Completion metadata recorded by the treasury on completion (person
	// payouts and payment requests).
	CompletionPaidDate         *time.Time `gorm:"type:date"`
	CompletionPaymentReference string     `gorm:"not null;default:''"`

	// Soft delete (AIP-164). PurgeTime marks when the soft-deleted submission
	// is treated as purged (read-time purge after the retention period).
	DeletedAt gorm.DeletedAt
	PurgeTime *time.Time

	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`
	UpdatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Relations
	Organization Organization `gorm:"foreignKey:OrganizationID"`
	Committee    Committee    `gorm:"foreignKey:CommitteeID"`
	CreatedBy    User         `gorm:"foreignKey:CreatedByUserID"`
}

func (Submission) TableName() string { return "submissions" }

func (m *Submission) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}

	// Submissions are not addressable by a user-supplied custom_id; the
	// custom_id is always the primary key id (same convention as
	// transactions).
	m.CustomID = m.ID.String()

	return nil
}

func (m *Submission) Exists() bool {
	return m != nil && m.ID != uuid.Nil
}
