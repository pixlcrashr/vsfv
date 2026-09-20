package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/model/dao"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"gorm.io/gorm"
)

var (
	ErrSubmissionNotFound          = errors.New("submission not found")
	ErrSubmissionItemNotFound      = errors.New("submission item not found")
	ErrSubmissionCommentNotFound   = errors.New("submission comment not found")
	ErrSubmissionAttachmentNotFound = errors.New("submission attachment not found")
	ErrSubmissionAlreadyExists     = errors.New("submission already exists")
)

// SubmissionOrderFieldMapper maps API order_by field names to database column names.
var SubmissionOrderFieldMapper = order.FieldMapper{
	"createTime": "created_at",
	"updateTime": "updated_at",
}

// ListSubmissionsParams drives the List query.
type ListSubmissionsParams struct {
	// Cond is an optional abstract condition chain.
	Cond cond.Cond
	// Explicit filters resolved by the service from extracted AIP-160 filters.
	Direction       *model.Direction
	Settlement      *model.Settlement
	Status          *model.SubmissionStatus
	CommitteeID     *uuid.UUID
	CreatedByUserID *uuid.UUID
	// ShowDeleted includes soft-deleted (not yet purged) submissions.
	ShowDeleted bool
	// ExcludeDrafts hides DRAFT submissions regardless of the status filter.
	ExcludeDrafts bool
	// OrderBy specifies the sort field and direction as SQL expressions.
	OrderBy []order.Expr
	// Page number (1-indexed).
	Page int
	// PageSize caps the number of rows returned.
	PageSize int
}

// submissionColumnMapper maps filter field names to database column names.
func submissionColumnMapper(field string) (string, bool) {
	switch field {
	default:
		return "", false
	}
}

// visibilityWhere restricts results to non-purged rows. With showDeleted, rows
// that are soft-deleted but not yet purged remain visible (AIP-164); without
// it, only live rows are returned.
func visibilityWhere(showDeleted bool) string {
	if showDeleted {
		return "deleted_at IS NULL OR purge_time IS NULL OR purge_time > NOW()"
	}
	return "deleted_at IS NULL"
}

// SubmissionRepository provides CRUD for submissions and their items,
// comments and attachments.
type SubmissionRepository struct {
	db *gorm.DB
	q  *dao.Query
}

// NewSubmissionRepository creates a SubmissionRepository backed by db.
func NewSubmissionRepository(db *gorm.DB) *SubmissionRepository {
	return &SubmissionRepository{db: db, q: dao.Use(db)}
}

// ── Submission ───────────────────────────────────────────────────────────────

// List returns submissions matching params along with the total count.
func (r *SubmissionRepository) List(ctx context.Context, params ListSubmissionsParams) ([]*model.Submission, int64, error) {
	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}

	db := r.db.WithContext(ctx).Unscoped().Model(&model.Submission{}).
		Where(visibilityWhere(params.ShowDeleted))

	db = cond.Apply(db, params.Cond, submissionColumnMapper)

	if params.Direction != nil {
		db = db.Where("direction = ?", int(*params.Direction))
	}
	if params.Settlement != nil {
		db = db.Where("settlement = ?", int(*params.Settlement))
	}
	if params.Status != nil {
		db = db.Where("status = ?", int(*params.Status))
	}
	if params.ExcludeDrafts {
		db = db.Where("status <> ?", int(model.SubmissionStatusDraft))
	}
	if params.CommitteeID != nil {
		db = db.Where("committee_id = ?", *params.CommitteeID)
	}
	if params.CreatedByUserID != nil {
		db = db.Where("created_by_user_id = ?", *params.CreatedByUserID)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count submissions page=%d: %w", params.Page, err)
	}

	if len(params.OrderBy) > 0 {
		for _, expr := range params.OrderBy {
			db = db.Order(expr.String())
		}
	} else {
		db = db.Order("created_at DESC, id DESC")
	}

	offset := (params.Page - 1) * params.PageSize
	if offset > 0 {
		db = db.Offset(offset)
	}
	db = db.Limit(params.PageSize)

	var ms []*model.Submission
	if err := db.Find(&ms).Error; err != nil {
		return nil, 0, fmt.Errorf("list submissions page=%d: %w", params.Page, err)
	}

	return ms, total, nil
}

// GetByID returns the submission with the given ID (including soft-deleted,
// unless purged).
func (r *SubmissionRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Submission, error) {
	var m model.Submission
	err := r.db.WithContext(ctx).Unscoped().
		Where("id = ?", id).
		Where(visibilityWhere(true)).
		First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrSubmissionNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get submission id=%s: %w", id, err)
	}
	return &m, nil
}

// GetByCustomID returns the submission with the given custom ID within an
// organization (including soft-deleted, unless purged).
func (r *SubmissionRepository) GetByCustomID(ctx context.Context, orgID uuid.UUID, customID string) (*model.Submission, error) {
	var m model.Submission
	err := r.db.WithContext(ctx).Unscoped().
		Where("organization_id = ? AND custom_id = ?", orgID, customID).
		Where(visibilityWhere(true)).
		First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrSubmissionNotFound, fmt.Errorf("organization_id=%s custom_id=%s: %w", orgID, customID, err))
		}
		return nil, fmt.Errorf("get submission organization_id=%s custom_id=%s: %w", orgID, customID, err)
	}
	return &m, nil
}

// CreateSubmissionParams holds the fields required to create a submission.
type CreateSubmissionParams struct {
	OrganizationID uuid.UUID
	CreatedByUserID uuid.UUID
	CommitteeID    uuid.UUID
	Direction      model.Direction
	Settlement     model.Settlement
	Scope          model.Scope
	Notice         string
}

// Create inserts a new submission in DRAFT state and assigns its per-org-year
// public ID.
func (r *SubmissionRepository) Create(ctx context.Context, params CreateSubmissionParams) (*model.Submission, error) {
	m := &model.Submission{
		OrganizationID:  params.OrganizationID,
		CreatedByUserID: params.CreatedByUserID,
		CommitteeID:     params.CommitteeID,
		Direction:       params.Direction,
		Settlement:      params.Settlement,
		Scope:           params.Scope,
		Status:          model.SubmissionStatusDraft,
		Notice:          params.Notice,
	}

	year := time.Now().UTC().Year()
	for attempt := 0; attempt < 10; attempt++ {
		seq, err := r.nextSubmissionSequence(ctx, params.OrganizationID, year)
		if err != nil {
			return nil, err
		}
		m.PublicID = fmt.Sprintf("%d/%02d", year, seq)

		err = r.db.WithContext(ctx).Create(m).Error
		if err == nil {
			return m, nil
		}
		if !errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, fmt.Errorf("create submission custom_id=%s: %w", m.CustomID, err)
		}
		// Public ID taken (concurrent creation) — retry with the next sequence.
	}
	return nil, errors.Join(ErrSubmissionAlreadyExists, fmt.Errorf("public_id allocation failed for organization_id=%s", params.OrganizationID))
}

// nextSubmissionSequence returns the next free sequence number for the given
// organization and year, counting all submissions (including soft-deleted) so
// IDs are never reused.
func (r *SubmissionRepository) nextSubmissionSequence(ctx context.Context, orgID uuid.UUID, year int) (int, error) {
	var count int64
	err := r.db.WithContext(ctx).Unscoped().Model(&model.Submission{}).
		Where("organization_id = ?", orgID).
		Where("created_at >= ? AND created_at < ?", fmt.Sprintf("%d-01-01", year), fmt.Sprintf("%d-01-01", year+1)).
		Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("count submissions for public id organization_id=%s year=%d: %w", orgID, year, err)
	}
	return int(count) + 1, nil
}

// UpdateSubmissionParams holds the mutable fields of a submission. Pointer
// slices/nullable columns use optional wrappers; the service builds the set
// from the update field mask.
type UpdateSubmissionParams struct {
	CommitteeID            optional.Optional[uuid.UUID]
	Direction              optional.Optional[model.Direction]
	Settlement             optional.Optional[model.Settlement]
	Scope                  optional.Optional[model.Scope]
	Notice                 optional.Optional[string]
	PayoutMethod           optional.Optional[model.PayoutMethod]
	BankAccountHolder      optional.Optional[string]
	BankIban               optional.Optional[string]
	BankBic                optional.Optional[string]
	PaymentAccountUID      optional.Optional[uuid.NullUUID]
	PaymentAccountLabel    optional.Optional[string]
	AccountPaidDate        optional.Optional[*time.Time]
	AccountPaymentReference optional.Optional[string]
	VendorName             optional.Optional[string]
	VendorIban             optional.Optional[string]
	VendorBic              optional.Optional[string]
	VendorTiming           optional.Optional[model.PaymentRequestTiming]
	CompletionPaidDate     optional.Optional[*time.Time]
	CompletionPaymentReference optional.Optional[string]
	Etag                   optional.Optional[string]
}

// Update updates fields of an existing submission matched by its primary key.
func (r *SubmissionRepository) Update(ctx context.Context, id uuid.UUID, params UpdateSubmissionParams) error {
	sets := map[string]any{}
	put := func(key string, v any) { sets[key] = v }

	if params.CommitteeID.IsSet {
		put("committee_id", params.CommitteeID.Value)
	}
	if params.Direction.IsSet {
		put("direction", int(params.Direction.Value))
	}
	if params.Settlement.IsSet {
		put("settlement", int(params.Settlement.Value))
	}
	if params.Scope.IsSet {
		put("scope", int(params.Scope.Value))
	}
	if params.Notice.IsSet {
		put("notice", params.Notice.Value)
	}
	if params.PayoutMethod.IsSet {
		put("payout_method", int(params.PayoutMethod.Value))
	}
	if params.BankAccountHolder.IsSet {
		put("bank_account_holder", params.BankAccountHolder.Value)
	}
	if params.BankIban.IsSet {
		put("bank_iban", params.BankIban.Value)
	}
	if params.BankBic.IsSet {
		put("bank_bic", params.BankBic.Value)
	}
	if params.PaymentAccountUID.IsSet {
		put("payment_account_uid", params.PaymentAccountUID.Value)
	}
	if params.PaymentAccountLabel.IsSet {
		put("payment_account_label", params.PaymentAccountLabel.Value)
	}
	if params.AccountPaidDate.IsSet {
		put("account_paid_date", params.AccountPaidDate.Value)
	}
	if params.AccountPaymentReference.IsSet {
		put("account_payment_reference", params.AccountPaymentReference.Value)
	}
	if params.VendorName.IsSet {
		put("vendor_name", params.VendorName.Value)
	}
	if params.VendorIban.IsSet {
		put("vendor_iban", params.VendorIban.Value)
	}
	if params.VendorBic.IsSet {
		put("vendor_bic", params.VendorBic.Value)
	}
	if params.VendorTiming.IsSet {
		put("vendor_timing", int(params.VendorTiming.Value))
	}
	if params.CompletionPaidDate.IsSet {
		put("completion_paid_date", params.CompletionPaidDate.Value)
	}
	if params.CompletionPaymentReference.IsSet {
		put("completion_payment_reference", params.CompletionPaymentReference.Value)
	}
	if params.Etag.IsSet {
		put("etag", params.Etag.Value)
	}

	if len(sets) == 0 {
		return nil
	}

	result := r.db.WithContext(ctx).Unscoped().Model(&model.Submission{}).
		Where("id = ?", id).
		Where(visibilityWhere(true)).
		Updates(sets)
	if result.Error != nil {
		return fmt.Errorf("update submission id=%s: %w", id, result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrSubmissionNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}

// UpdateStatus transitions the status of a submission, guarded by the expected
// previous status so concurrent transitions fail safely. Returns
// ErrSubmissionNotFound if the row does not match.
func (r *SubmissionRepository) UpdateStatus(ctx context.Context, id uuid.UUID, from, to model.SubmissionStatus) error {
	result := r.db.WithContext(ctx).Unscoped().Model(&model.Submission{}).
		Where("id = ? AND status = ?", id, int(from)).
		Where(visibilityWhere(true)).
		Update("status", int(to))
	if result.Error != nil {
		return fmt.Errorf("update submission status id=%s: %w", id, result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrSubmissionNotFound, fmt.Errorf("id=%s status=%d: %w", id, int(from), gorm.ErrRecordNotFound))
	}
	return nil
}

// SoftDelete marks the submission deleted and sets the purge deadline.
func (r *SubmissionRepository) SoftDelete(ctx context.Context, id uuid.UUID, purgeAfter time.Duration) error {
	now := time.Now().UTC()
	result := r.db.WithContext(ctx).Unscoped().Model(&model.Submission{}).
		Where("id = ?", id).
		Where(visibilityWhere(true)).
		Updates(map[string]any{"deleted_at": now, "purge_time": now.Add(purgeAfter)})
	if result.Error != nil {
		return fmt.Errorf("soft delete submission id=%s: %w", id, result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrSubmissionNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}

// Undelete restores a soft-deleted submission.
func (r *SubmissionRepository) Undelete(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).Unscoped().Model(&model.Submission{}).
		Where("id = ?", id).
		Where("deleted_at IS NOT NULL").
		Updates(map[string]any{"deleted_at": nil, "purge_time": nil})
	if result.Error != nil {
		return fmt.Errorf("undelete submission id=%s: %w", id, result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrSubmissionNotFound, fmt.Errorf("id=%s not deleted: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}

// CountByCommittee returns how many (non-purged) submissions reference the
// committee; used to guard committee deletion.
func (r *SubmissionRepository) CountByCommittee(ctx context.Context, committeeID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Unscoped().Model(&model.Submission{}).
		Where("committee_id = ?", committeeID).
		Where(visibilityWhere(true)).
		Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("count submissions committee_id=%s: %w", committeeID, err)
	}
	return count, nil
}

// ListDecayable returns all non-draft, non-terminal submissions of an
// organization that are still open (used by the deadline sweeper).
func (r *SubmissionRepository) ListDecayable(ctx context.Context, orgID uuid.UUID) ([]*model.Submission, error) {
	var ms []*model.Submission
	err := r.db.WithContext(ctx).Model(&model.Submission{}).
		Where("organization_id = ?", orgID).
		Where("status IN ?", []model.SubmissionStatus{model.SubmissionStatusPending, model.SubmissionStatusFurtherInfoRequired}).
		Find(&ms).Error
	if err != nil {
		return nil, fmt.Errorf("list decayable submissions organization_id=%s: %w", orgID, err)
	}
	return ms, nil
}

// ── Items ────────────────────────────────────────────────────────────────────

// CreateItemParams holds the fields required to create a submission item.
type CreateItemParams struct {
	SubmissionID uuid.UUID
	PublicIDBase string // submission public ID, e.g. "2026/04"
	Category     string
	DocumentForm model.DocumentForm
	Source       string
	Description  string
	Amount       apd.Decimal
}

// CreateItem inserts a new item and assigns its public ID
// ("{submission public_id}/{index}").
func (r *SubmissionRepository) CreateItem(ctx context.Context, params CreateItemParams) (*model.SubmissionItem, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.SubmissionItem{}).
		Where("submission_id = ?", params.SubmissionID).
		Count(&count).Error; err != nil {
		return nil, fmt.Errorf("count items submission_id=%s: %w", params.SubmissionID, err)
	}

	m := &model.SubmissionItem{
		SubmissionID: params.SubmissionID,
		Category:     params.Category,
		DocumentForm: params.DocumentForm,
		Source:       params.Source,
		Description:  params.Description,
		Amount:       params.Amount,
	}

	for attempt := 0; attempt < 20; attempt++ {
		m.PublicID = fmt.Sprintf("%s/%d", params.PublicIDBase, int(count)+1+attempt)
		err := r.db.WithContext(ctx).Create(m).Error
		if err == nil {
			return m, nil
		}
		if !errors.Is(err, gorm.ErrDuplicatedKey) {
			return nil, fmt.Errorf("create submission item submission_id=%s: %w", params.SubmissionID, err)
		}
	}
	return nil, errors.Join(ErrSubmissionAlreadyExists, fmt.Errorf("item public_id allocation failed submission_id=%s", params.SubmissionID))
}

// UpdateItemParams holds the mutable fields of a submission item.
type UpdateItemParams struct {
	Category     optional.Optional[string]
	DocumentForm optional.Optional[model.DocumentForm]
	Source       optional.Optional[string]
	Description  optional.Optional[string]
	Amount       optional.Optional[apd.Decimal]
}

// UpdateItem updates fields of an existing item matched by its primary key.
func (r *SubmissionRepository) UpdateItem(ctx context.Context, id uuid.UUID, params UpdateItemParams) error {
	sets := map[string]any{}
	if params.Category.IsSet {
		sets["category"] = params.Category.Value
	}
	if params.DocumentForm.IsSet {
		sets["document_form"] = int(params.DocumentForm.Value)
	}
	if params.Source.IsSet {
		sets["source"] = params.Source.Value
	}
	if params.Description.IsSet {
		sets["description"] = params.Description.Value
	}
	if params.Amount.IsSet {
		sets["amount"] = params.Amount.Value
	}

	if len(sets) == 0 {
		return nil
	}

	result := r.db.WithContext(ctx).Model(&model.SubmissionItem{}).
		Where("id = ?", id).
		Updates(sets)
	if result.Error != nil {
		return fmt.Errorf("update submission item id=%s: %w", id, result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrSubmissionItemNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}

// DeleteItem removes the item with the given ID.
func (r *SubmissionRepository) DeleteItem(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).Delete(&model.SubmissionItem{}, id)
	if result.Error != nil {
		return fmt.Errorf("delete submission item id=%s: %w", id, result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.Join(ErrSubmissionItemNotFound, fmt.Errorf("id=%s: %w", id, gorm.ErrRecordNotFound))
	}
	return nil
}

// GetItemByID returns the item with the given ID.
func (r *SubmissionRepository) GetItemByID(ctx context.Context, id uuid.UUID) (*model.SubmissionItem, error) {
	m, err := r.q.SubmissionItem.WithContext(ctx).Where(r.q.SubmissionItem.ID.Eq(id)).First()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrSubmissionItemNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get submission item id=%s: %w", id, err)
	}
	return m, nil
}

// ListItems returns the items of a submission in insertion order.
func (r *SubmissionRepository) ListItems(ctx context.Context, submissionID uuid.UUID) ([]*model.SubmissionItem, error) {
	var ms []*model.SubmissionItem
	err := r.db.WithContext(ctx).
		Where("submission_id = ?", submissionID).
		Order("created_at ASC, id ASC").
		Find(&ms).Error
	if err != nil {
		return nil, fmt.Errorf("list submission items submission_id=%s: %w", submissionID, err)
	}
	return ms, nil
}

// RecomputeTotal recalculates the total amount of a submission from its items
// and persists it. Returns the new total.
func (r *SubmissionRepository) RecomputeTotal(ctx context.Context, submissionID uuid.UUID) (apd.Decimal, error) {
	var total apd.Decimal
	err := r.db.WithContext(ctx).Model(&model.SubmissionItem{}).
		Where("submission_id = ?", submissionID).
		Select("COALESCE(SUM(amount), 0) AS total").
		Scan(&total).Error
	if err != nil {
		return apd.Decimal{}, fmt.Errorf("sum submission items submission_id=%s: %w", submissionID, err)
	}

	if err := r.db.WithContext(ctx).Unscoped().Model(&model.Submission{}).
		Where("id = ?", submissionID).
		Update("total_amount", total).Error; err != nil {
		return apd.Decimal{}, fmt.Errorf("update submission total submission_id=%s: %w", submissionID, err)
	}
	return total, nil
}

// ── Comments ─────────────────────────────────────────────────────────────────

// CreateComment inserts a new comment on a submission.
func (r *SubmissionRepository) CreateComment(ctx context.Context, m *model.SubmissionComment) error {
	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		return fmt.Errorf("create submission comment submission_id=%s: %w", m.SubmissionID, err)
	}
	return nil
}

// ListComments returns the comments of a submission in chronological order.
// Admin-only comments are omitted when includeAdminOnly is false.
func (r *SubmissionRepository) ListComments(ctx context.Context, submissionID uuid.UUID, includeAdminOnly bool) ([]*model.SubmissionComment, error) {
	var ms []*model.SubmissionComment
	db := r.db.WithContext(ctx).Where("submission_id = ?", submissionID)
	if !includeAdminOnly {
		db = db.Where("is_admin_only = ?", false)
	}
	err := db.Order("created_at ASC, id ASC").Find(&ms).Error
	if err != nil {
		return nil, fmt.Errorf("list submission comments submission_id=%s: %w", submissionID, err)
	}
	return ms, nil
}

// ── Attachments ──────────────────────────────────────────────────────────────

// CreateAttachment inserts new attachment metadata.
func (r *SubmissionRepository) CreateAttachment(ctx context.Context, m *model.SubmissionAttachment) error {
	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		return fmt.Errorf("create submission attachment item_id=%s: %w", m.SubmissionItemID, err)
	}
	return nil
}

// GetAttachmentByID returns the attachment metadata with the given ID.
func (r *SubmissionRepository) GetAttachmentByID(ctx context.Context, id uuid.UUID) (*model.SubmissionAttachment, error) {
	var m model.SubmissionAttachment
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrSubmissionAttachmentNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get submission attachment id=%s: %w", id, err)
	}
	return &m, nil
}

// ListAttachments returns the attachments of an item in insertion order.
func (r *SubmissionRepository) ListAttachments(ctx context.Context, itemID uuid.UUID) ([]*model.SubmissionAttachment, error) {
	var ms []*model.SubmissionAttachment
	err := r.db.WithContext(ctx).
		Where("submission_item_id = ?", itemID).
		Order("created_at ASC, id ASC").
		Find(&ms).Error
	if err != nil {
		return nil, fmt.Errorf("list submission attachments item_id=%s: %w", itemID, err)
	}
	return ms, nil
}

// DeleteAttachment removes the attachment metadata with the given ID. The
// caller is responsible for deleting the binary from storage.
func (r *SubmissionRepository) DeleteAttachment(ctx context.Context, id uuid.UUID) (*model.SubmissionAttachment, error) {
	m, err := r.GetAttachmentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := r.db.WithContext(ctx).Delete(&model.SubmissionAttachment{}, id).Error; err != nil {
		return nil, fmt.Errorf("delete submission attachment id=%s: %w", id, err)
	}
	return m, nil
}
