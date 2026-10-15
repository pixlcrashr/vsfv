package model

import (
	"database/sql/driver"
	"fmt"
	"time"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Type mirrors the proto Submission.type oneof: whether a
// submission documents an income/expense or a collection of misc documents.
type SubmissionType int

const (
	SubmissionTypeIncomeExpense SubmissionType = iota
	SubmissionTypeMisc
)

// SubmissionDirection mirrors the proto SubmissionTypeIncomeExpenseDetails.direction
// oneof. It is only populated for income/expense submissions.
type SubmissionDirection int

const (
	SubmissionDirectionIncome SubmissionDirection = iota
	SubmissionDirectionExpense
)

func (d SubmissionDirection) IsValid() bool {
	switch d {
	case SubmissionDirectionIncome, SubmissionDirectionExpense:
		return true
	default:
		return false
	}
}

type NullSubmissionDirection struct {
	SubmissionDirection SubmissionDirection
	Valid               bool
}

func (nd *NullSubmissionDirection) Scan(value any) error {
	if value == nil {
		nd.SubmissionDirection = 0
		nd.Valid = false
		return nil
	}

	var r int64

	switch v := value.(type) {
	case int64:
		r = v
	case int32:
		r = int64(v)
	case int:
		r = int64(v)
	case []byte:
		var p int64
		if _, err := fmt.Sscanf(string(v), "%d", &p); err != nil {
			return fmt.Errorf("NullSubmissionDirection.Scan: parse []byte: %w", err)
		}
		r = p
	case string:
		var p int64
		if _, err := fmt.Sscanf(string(v), "%d", &p); err != nil {
			return fmt.Errorf("NullSubmissionDirection.Scan: parse string: %w", err)
		}
		r = p
	default:
		return fmt.Errorf("NullSubmissionDirection.Scan: unsupported type %T", value)
	}

	d := SubmissionDirection(r)
	if !d.IsValid() {
		return fmt.Errorf("NullSubmissionDirection.Scan: invalid SubmissionDirection value %d", r)
	}

	nd.SubmissionDirection = d
	nd.Valid = true
	return nil
}

func (nd NullSubmissionDirection) Value() (driver.Value, error) {
	if !nd.Valid {
		return nil, nil
	}

	if !nd.SubmissionDirection.IsValid() {
		return nil, fmt.Errorf("NullSubmissionDirection.Value: invalid SubmissionDirection value %d", nd.SubmissionDirection)
	}

	return int64(nd.SubmissionDirection), nil
}

// Settlement mirrors the proto SubmissionDirectionExpenseDetails.settlement
// oneof. It is only populated for expense submissions.
type SubmissionSettlementType int

const (
	SubmissionSettlementTypePerson SubmissionSettlementType = iota
	SubmissionSettlementTypeCommitteeAccount
	SubmissionSettlementTypePaymentRequest
)

func (d SubmissionSettlementType) IsValid() bool {
	switch d {
	case SubmissionSettlementTypePerson, SubmissionSettlementTypeCommitteeAccount, SubmissionSettlementTypePaymentRequest:
		return true
	default:
		return false
	}
}

type NullSubmissionSettlementType struct {
	SubmissionSettlementType SubmissionSettlementType
	Valid                    bool
}

func (nd *NullSubmissionSettlementType) Scan(value any) error {
	if value == nil {
		nd.SubmissionSettlementType = 0
		nd.Valid = false
		return nil
	}

	var r int64

	switch v := value.(type) {
	case int64:
		r = v
	case int32:
		r = int64(v)
	case int:
		r = int64(v)
	case []byte:
		var p int64
		if _, err := fmt.Sscanf(string(v), "%d", &p); err != nil {
			return fmt.Errorf("NullSubmissionSettlementType.Scan: parse []byte: %w", err)
		}
		r = p
	case string:
		var p int64
		if _, err := fmt.Sscanf(string(v), "%d", &p); err != nil {
			return fmt.Errorf("NullSubmissionSettlementType.Scan: parse string: %w", err)
		}
		r = p
	default:
		return fmt.Errorf("NullSubmissionSettlementType.Scan: unsupported type %T", value)
	}

	d := SubmissionSettlementType(r)
	if !d.IsValid() {
		return fmt.Errorf("NullSubmissionSettlementType.Scan: invalid SubmissionSettlementType value %d", r)
	}

	nd.SubmissionSettlementType = d
	nd.Valid = true
	return nil
}

func (nd NullSubmissionSettlementType) Value() (driver.Value, error) {
	if !nd.Valid {
		return nil, nil
	}

	if !nd.SubmissionSettlementType.IsValid() {
		return nil, fmt.Errorf("NullSubmissionSettlementType.Value: invalid SubmissionSettlementType value %d", nd.SubmissionSettlementType)
	}

	return int64(nd.SubmissionSettlementType), nil
}

// Scope mirrors the proto SubmissionScope enum. It is only populated for
// income/expense submissions.
type SubmissionScope int

const (
	SubmissionScopeNone SubmissionScope = iota
	SubmissionScopeNonprofit
	SubmissionScopeCommercial
)

// Status mirrors the proto SubmissionStatus enum.
type SubmissionStatus int

const (
	SubmissionStatusDraft SubmissionStatus = iota
	SubmissionStatusPending
	SubmissionStatusFurtherInfoRequired
	SubmissionStatusRejected
	SubmissionStatusApproved
	SubmissionStatusCompleted
)

// PayoutMethod mirrors the proto SubmissionSettlementPerson.payout_method
// oneof. It is only populated for person settlements.
type SubmissionPersonPayoutMethod int

const (
	SubmissionPersonPayoutMethodBankTransfer SubmissionPersonPayoutMethod = iota
	SubmissionPersonPayoutMethodCash
)

func (d SubmissionPersonPayoutMethod) IsValid() bool {
	switch d {
	case SubmissionPersonPayoutMethodBankTransfer, SubmissionPersonPayoutMethodCash:
		return true
	default:
		return false
	}
}

type NullSubmissionPersonPayoutMethod struct {
	SubmissionPersonPayoutMethod SubmissionPersonPayoutMethod
	Valid                        bool
}

func (nd *NullSubmissionPersonPayoutMethod) Scan(value any) error {
	if value == nil {
		nd.SubmissionPersonPayoutMethod = 0
		nd.Valid = false
		return nil
	}

	var r int64

	switch v := value.(type) {
	case int64:
		r = v
	case int32:
		r = int64(v)
	case int:
		r = int64(v)
	case []byte:
		var p int64
		if _, err := fmt.Sscanf(string(v), "%d", &p); err != nil {
			return fmt.Errorf("NullSubmissionPersonPayoutMethod.Scan: parse []byte: %w", err)
		}
		r = p
	case string:
		var p int64
		if _, err := fmt.Sscanf(string(v), "%d", &p); err != nil {
			return fmt.Errorf("NullSubmissionPersonPayoutMethod.Scan: parse string: %w", err)
		}
		r = p
	default:
		return fmt.Errorf("NullSubmissionPersonPayoutMethod.Scan: unsupported type %T", value)
	}

	d := SubmissionPersonPayoutMethod(r)
	if !d.IsValid() {
		return fmt.Errorf("NullSubmissionPersonPayoutMethod.Scan: invalid SubmissionPersonPayoutMethod value %d", r)
	}

	nd.SubmissionPersonPayoutMethod = d
	nd.Valid = true
	return nil
}

func (nd NullSubmissionPersonPayoutMethod) Value() (driver.Value, error) {
	if !nd.Valid {
		return nil, nil
	}

	if !nd.SubmissionPersonPayoutMethod.IsValid() {
		return nil, fmt.Errorf("NullSubmissionPersonPayoutMethod.Value: invalid SubmissionPersonPayoutMethod value %d", nd.SubmissionPersonPayoutMethod)
	}

	return int64(nd.SubmissionPersonPayoutMethod), nil
}

// Submission is a documented expense or income with receipts, submitted by a
// committee member and reviewed by the treasury.
//
// The nullable enum columns (type, direction, settlement, scope, payout
// method) mirror the proto oneofs: a column stays NULL while its switch is
// off (misc disables direction/scope/settlement, income disables settlement,
// expense+person enables the payout method) or the value has not been picked
// yet. The detail column groups follow the same rule and use a naming scheme
// of {Settlement}Bank + proto BankAccount field, since each group is only
// populated for the settlement that gates it.
type Submission struct {
	ID              uuid.UUID                    `gorm:"type:uuid;primaryKey;uniqueIndex:idx_submissions_org_id,priority:1"`
	CustomID        string                       `gorm:"not null;uniqueIndex:idx_submissions_org_custom_id,priority:1"`
	PublicID        string                       `gorm:"not null;default:'';uniqueIndex:idx_submissions_org_public_id,priority:2"`
	OrganizationID  uuid.UUID                    `gorm:"type:uuid;not null;uniqueIndex:idx_submissions_org_id,priority:2;uniqueIndex:idx_submissions_org_custom_id,priority:2;uniqueIndex:idx_submissions_org_public_id,priority:1"`
	CreatedByUserID uuid.UUID                    `gorm:"type:uuid;not null;index:idx_submissions_created_by"`
	CommitteeID     uuid.UUID                    `gorm:"type:uuid;not null;index:idx_submissions_committee"`
	Type            SubmissionType               `gorm:"type:int;not null"`
	Direction       NullSubmissionDirection      `gorm:"type:int"`
	SettlementType  NullSubmissionSettlementType `gorm:"type:int"`
	Scope           SubmissionScope              `gorm:"type:int;not null"`
	Status          SubmissionStatus             `gorm:"type:int;not null;index:idx_submissions_status"`
	Notice          string                       `gorm:"not null;default:''"`
	TotalAmount     apd.Decimal                  `gorm:"type:decimal;not null"`

	// Person settlement details (settlement=person): the payout method and,
	// for bank transfers, the payout bank details (proto
	// SubmissionPayoutMethodBankTransfer.bank_account).
	PersonPayoutMethod      NullSubmissionPersonPayoutMethod `gorm:"type:int"`
	PersonBankAccountHolder *string                          `gorm:""`
	PersonBankIban          *string                          `gorm:""`
	PersonBankBic           *string                          `gorm:""`
	PersonBankAccountNumber *string                          `gorm:""`

	// Committee account settlement details (settlement=committee_account).
	CommitteePaymentAccountID        uuid.NullUUID `gorm:"type:uuid"`
	CommitteePaymentAccountLabel     *string       `gorm:""`
	CommitteeAccountPaidDate         *time.Time    `gorm:"type:date"`
	CommitteeAccountPaymentReference *string       `gorm:""`

	// Payment request bank details, i.e. the recipient the treasury pays
	// (settlement=payment_request; proto SubmissionSettlementPaymentRequest.bank_account).
	PaymentRequestBankAccountHolder *string `gorm:""`
	PaymentRequestBankIban          *string `gorm:""`
	PaymentRequestBankBic           *string `gorm:""`
	PaymentRequestBankAccountNumber *string `gorm:""`

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
