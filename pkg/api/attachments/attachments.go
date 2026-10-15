// Package attachments serves submission item attachments (binary files) via
// Huma-hosted exception endpoints. The binary transfer deliberately lives
// outside the protobuf-generated API; metadata is exposed as JSON and the
// bytes through a /download sub-path (Fiber cannot parse AIP-style
// `{param}:verb` suffixes within a single path segment).
package attachments

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/api/humax"
	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	"github.com/pixlcrashr/vsfv/pkg/storage"
	"gorm.io/gorm"
)

// maxAttachmentSize bounds attachment uploads (10 MiB).
const maxAttachmentSize = 10 << 20

// allowedMimeTypes is the set of accepted attachment content types.
var allowedMimeTypes = map[string]bool{
	"application/pdf": true,
	"image/jpeg":      true,
	"image/png":       true,
}

// Deps bundles everything the attachment endpoints need.
type Deps struct {
	Auth     *humax.AuthDeps
	Enforcer *authz.Enforcer
	Storage  *storage.FileStorage
	Audits   *audit.Writer
}

// RegisterRoutes wires the attachment endpoints onto the given Huma API. The
// routes must be registered before the grpc-gateway's /api/v1/* catch-all.
func RegisterRoutes(api huma.API, db *gorm.DB, deps *Deps) {
	h := &handlers{
		db:       db,
		repo:     repository.NewSubmissionRepository(db),
		auth:     deps.Auth,
		enforcer: deps.Enforcer,
		storage:  deps.Storage,
		audits:   deps.Audits,
	}

	huma.Register(api, huma.Operation{
		OperationID:   "create-attachment",
		Method:        http.MethodPost,
		Path:          "/api/v1/organizations/{organization_id}/submissions/{submission_id}/items/{item_id}/attachments",
		Summary:       "Upload an attachment",
		Description:   "Uploads a binary file (multipart field \"file\") for a submission item. Allowed types: PDF, JPEG, PNG; max 10 MiB.",
		Tags:          []string{"Attachments"},
		MaxBodyBytes:  maxAttachmentSize,
		DefaultStatus: http.StatusCreated,
	}, h.create)

	huma.Register(api, huma.Operation{
		OperationID: "list-attachments",
		Method:      http.MethodGet,
		Path:        "/api/v1/organizations/{organization_id}/submissions/{submission_id}/items/{item_id}/attachments",
		Summary:     "List attachments of an item",
		Tags:        []string{"Attachments"},
	}, h.list)

	huma.Register(api, huma.Operation{
		OperationID: "get-attachment",
		Method:      http.MethodGet,
		Path:        "/api/v1/organizations/{organization_id}/submissions/{submission_id}/items/{item_id}/attachments/{attachment_id}",
		Summary:     "Get attachment metadata",
		Tags:        []string{"Attachments"},
	}, h.get)

	huma.Register(api, huma.Operation{
		OperationID: "download-attachment",
		Method:      http.MethodGet,
		Path:        "/api/v1/organizations/{organization_id}/submissions/{submission_id}/items/{item_id}/attachments/{attachment_id}/download",
		Summary:     "Download an attachment's binary content",
		Tags:        []string{"Attachments"},
	}, h.download)

	huma.Register(api, huma.Operation{
		OperationID:   "delete-attachment",
		Method:        http.MethodDelete,
		Path:          "/api/v1/organizations/{organization_id}/submissions/{submission_id}/items/{item_id}/attachments/{attachment_id}",
		Summary:       "Delete an attachment",
		Tags:          []string{"Attachments"},
		DefaultStatus: http.StatusNoContent,
	}, h.remove)
}

type handlers struct {
	db       *gorm.DB
	repo     *repository.SubmissionRepository
	auth     *humax.AuthDeps
	enforcer *authz.Enforcer
	storage  *storage.FileStorage
	audits   *audit.Writer
}

// Attachment metadata as returned by the JSON endpoints.
type attachmentBody struct {
	ID               string `json:"id"`
	SubmissionItemID string `json:"submission_item_id"`
	FileName         string `json:"file_name"`
	MimeType         string `json:"mime_type"`
	FileSize         int64  `json:"file_size"`
	Sha256Sum        string `json:"sha256_sum"`
	CreateTime       string `json:"create_time"`
}

type attachmentOutput struct {
	Body attachmentBody
}

type attachmentListOutput struct {
	Body []attachmentBody
}

type downloadOutput struct {
	Body               []byte
	ContentType        string `header:"Content-Type"`
	ContentDisposition string `header:"Content-Disposition"`
}

// ListInput carries the parameters shared by all attachment endpoints. Huma
// only descends into embedded structs whose type name is exported (an
// embedded field's name is its type name; unexported fields are skipped), so
// embedding the previously unexported type silently dropped the Authorization
// header and path parameters from every route that reused it.
type ListInput struct {
	Authorization  string `header:"Authorization" doc:"Bearer access token"`
	OrganizationID string `path:"organization_id"`
	SubmissionID   string `path:"submission_id"`
	ItemID         string `path:"item_id"`
}

type attachmentInput struct {
	ListInput
	AttachmentID string `path:"attachment_id"`
}

type createInput struct {
	ListInput
	RawBody multipart.Form
}

func (h *handlers) toBody(m *model.SubmissionAttachment) attachmentBody {
	return attachmentBody{
		ID:               m.ID.String(),
		SubmissionItemID: m.SubmissionItemID.String(),
		FileName:         m.DataItem.FileName,
		MimeType:         m.DataItem.MimeType,
		FileSize:         m.DataItem.FileSize,
		Sha256Sum:        m.DataItem.Sha256Sum,
		CreateTime:       m.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
}

// attachmentAuditChanges builds the audit change list for an attachment
// mutation. It combines the relation diff with the data item's file metadata,
// because the data item row is deleted alongside the relation and its
// metadata would otherwise be unrecoverable from the log.
func attachmentAuditChanges(m *model.SubmissionAttachment, action string) ([]model.AuditLogEntryChange, error) {
	creating := action == audit.ActionCreate
	relBefore, relAfter := any(m), any(m)
	itemBefore, itemAfter := any(&m.DataItem), any(&m.DataItem)
	if creating {
		relBefore, itemBefore = nil, nil
	} else {
		relAfter, itemAfter = nil, nil
	}

	relChanges, err := audit.DiffModels(relBefore, relAfter)
	if err != nil {
		return nil, fmt.Errorf("audit diff attachment: %w", err)
	}
	itemChanges, err := audit.DiffModels(itemBefore, itemAfter)
	if err != nil {
		return nil, fmt.Errorf("audit diff attachment data item: %w", err)
	}
	return append(relChanges, itemChanges...), nil
}

// recordAudit appends the audit log entry for an attachment mutation. The
// writer determines which connection the entry is written through; pass a
// tx-backed writer (audit.NewWriter(tx)) to make the entry part of the
// caller's transaction.
func (h *handlers) recordAudit(ctx context.Context, w *audit.Writer, orgSegment string, item *model.SubmissionItem, m *model.SubmissionAttachment, action string) error {
	orgID, _ := uuid.Parse(orgSegment)
	changes, err := attachmentAuditChanges(m, action)
	if err != nil {
		return err
	}
	return w.RecordChanges(ctx, audit.Subject{
		ResourceName: fmt.Sprintf(
			"organizations/%s/submissions/%s/items/%s/attachments/%s",
			orgSegment, item.SubmissionID, item.ID, m.ID,
		),
		ResourceID:     m.ID,
		OrganizationID: uuid.NullUUID{Valid: orgID != uuid.Nil, UUID: orgID},
	}, action, changes)
}

// checkRead verifies read access to the parent submission.
func checkRead(ctx context.Context, enforcer *authz.Enforcer, orgSegment string, m *model.Submission) error {
	domain := authz.OrgDomain(orgSegment)
	if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionRead, domain); err == nil {
		return nil
	}
	if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionReadOwn, domain); err != nil {
		return humax.NewError(http.StatusForbidden, "permission denied")
	}
	user, _ := authz.UserIDFromContext(ctx)
	if user == "" || user != m.CreatedByUserID.String() {
		return humax.NewError(http.StatusForbidden, "permission denied")
	}
	return nil
}

// checkWrite verifies write access to the parent submission (treasury or
// owner) and that the submission is still editable.
func checkWrite(ctx context.Context, enforcer *authz.Enforcer, orgSegment string, m *model.Submission) error {
	domain := authz.OrgDomain(orgSegment)
	fullUpdate := false
	if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionUpdate, domain); err == nil {
		fullUpdate = true
	} else if err := authz.CheckOrg(ctx, enforcer, authz.ResourceSubmissions, authz.ActionUpdateOwn, domain); err != nil {
		return humax.NewError(http.StatusForbidden, "permission denied")
	} else {
		user, _ := authz.UserIDFromContext(ctx)
		if user == "" || user != m.CreatedByUserID.String() {
			return humax.NewError(http.StatusForbidden, "permission denied")
		}
	}

	if m.DeletedAt.Valid {
		return humax.NewError(422, "submission is deleted")
	}
	switch m.Status {
	case model.SubmissionStatusDraft, model.SubmissionStatusPending, model.SubmissionStatusFurtherInfoRequired:
		return nil
	default:
		_ = fullUpdate
		return humax.NewError(422, "submission is not editable in its current state")
	}
}

// loadItem resolves the item of a request and its parent submission.
func (h *handlers) loadItem(ctx context.Context, itemID string) (*model.SubmissionItem, *model.Submission, error) {
	id, err := uuid.Parse(itemID)
	if err != nil {
		return nil, nil, humax.NewError(http.StatusBadRequest, "invalid item_id")
	}
	item, err := h.repo.GetItemByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionItemNotFound) {
			return nil, nil, humax.NewError(http.StatusNotFound, "attachment item not found")
		}
		return nil, nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	parent, err := h.repo.GetByID(ctx, item.SubmissionID)
	if err != nil {
		return nil, nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	return item, parent, nil
}

func (h *handlers) create(ctx context.Context, input *createInput) (*attachmentOutput, error) {
	authed, err := humax.Auth(ctx, h.auth, input.Authorization)
	if err != nil {
		return nil, err
	}

	item, parent, err := h.loadItem(authed, input.ItemID)
	if err != nil {
		return nil, err
	}
	if err := checkWrite(authed, h.enforcer, input.OrganizationID, parent); err != nil {
		return nil, err
	}

	headers := input.RawBody.File["file"]
	if len(headers) == 0 {
		return nil, humax.NewError(http.StatusBadRequest, "missing file field")
	}
	fh := headers[0]

	mimeType := fh.Header.Get("Content-Type")
	file, err := fh.Open()
	if err != nil {
		return nil, humax.NewError(http.StatusBadRequest, "cannot read uploaded file")
	}
	defer file.Close()

	if mimeType == "" {
		var probe [512]byte
		n, _ := io.ReadFull(file, probe[:])
		mimeType = http.DetectContentType(probe[:n])
		if _, err := file.Seek(0, io.SeekStart); err != nil {
			return nil, humax.NewError(http.StatusBadRequest, "cannot read uploaded file")
		}
	}
	if !allowedMimeTypes[mimeType] {
		return nil, humax.NewError(http.StatusUnprocessableEntity, "unsupported file type")
	}
	if fh.Size > maxAttachmentSize {
		return nil, humax.NewError(http.StatusUnprocessableEntity, "file exceeds the 10 MiB limit")
	}

	// The blob is stored under the data item's UUID as file name; the data
	// item row and the attachment relation are created in one transaction.
	dataItemID := uuid.New()
	written, sum, err := h.storage.Store(dataItemID, io.LimitReader(file, maxAttachmentSize+1))
	if err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	if written > maxAttachmentSize {
		_ = h.storage.Remove(dataItemID)
		return nil, humax.NewError(http.StatusUnprocessableEntity, "file exceeds the 10 MiB limit")
	}

	m := &model.SubmissionAttachment{
		SubmissionItemID: item.ID,
		DataItem: model.DataItem{
			ID:        dataItemID,
			FileName:  filepath.Base(fh.Filename),
			MimeType:  mimeType,
			FileSize:  written,
			Sha256Sum: hex.EncodeToString(sum),
		},
	}
	if err := h.repo.CreateAttachment(ctx, m); err != nil {
		_ = h.storage.Remove(dataItemID)
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	if err := h.recordAudit(ctx, h.audits, input.OrganizationID, item, m, audit.ActionCreate); err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}

	return &attachmentOutput{Body: h.toBody(m)}, nil
}

func (h *handlers) list(ctx context.Context, input *ListInput) (*attachmentListOutput, error) {
	authed, err := humax.Auth(ctx, h.auth, input.Authorization)
	if err != nil {
		return nil, err
	}

	_, parent, err := h.loadItem(authed, input.ItemID)
	if err != nil {
		return nil, err
	}
	if err := checkRead(authed, h.enforcer, input.OrganizationID, parent); err != nil {
		return nil, err
	}

	item, _, err := h.loadItem(authed, input.ItemID)
	if err != nil {
		return nil, err
	}

	attachments, err := h.repo.ListAttachments(authed, item.ID)
	if err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}

	out := &attachmentListOutput{}
	for _, m := range attachments {
		out.Body = append(out.Body, h.toBody(m))
	}
	return out, nil
}

func (h *handlers) get(ctx context.Context, input *attachmentInput) (*attachmentOutput, error) {
	authed, err := humax.Auth(ctx, h.auth, input.Authorization)
	if err != nil {
		return nil, err
	}

	m, _, err := h.loadAttachmentForRead(authed, input)
	if err != nil {
		return nil, err
	}
	return &attachmentOutput{Body: h.toBody(m)}, nil
}

func (h *handlers) download(ctx context.Context, input *attachmentInput) (*downloadOutput, error) {
	authed, err := humax.Auth(ctx, h.auth, input.Authorization)
	if err != nil {
		return nil, err
	}

	m, _, err := h.loadAttachmentForRead(authed, input)
	if err != nil {
		return nil, err
	}

	f, err := h.storage.Open(m.DataItem.ID)
	if err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}

	return &downloadOutput{
		Body:               data,
		ContentType:        m.DataItem.MimeType,
		ContentDisposition: fmt.Sprintf("attachment; filename=\"%s\"", m.DataItem.FileName),
	}, nil
}

func (h *handlers) remove(ctx context.Context, input *attachmentInput) (*struct{}, error) {
	authed, err := humax.Auth(ctx, h.auth, input.Authorization)
	if err != nil {
		return nil, err
	}

	item, parent, err := h.loadItem(authed, input.ItemID)
	if err != nil {
		return nil, err
	}
	if err := checkWrite(authed, h.enforcer, input.OrganizationID, parent); err != nil {
		return nil, err
	}

	attachmentID, err := uuid.Parse(input.AttachmentID)
	if err != nil {
		return nil, humax.NewError(http.StatusBadRequest, "invalid attachment_id")
	}
	m, err := h.repo.GetAttachmentByID(ctx, attachmentID)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionAttachmentNotFound) {
			return nil, humax.NewError(http.StatusNotFound, "attachment not found")
		}
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	if m.SubmissionItemID != item.ID {
		return nil, humax.NewError(http.StatusNotFound, "attachment not found")
	}

	// The DB deletes and the audit entry join one transaction so they commit
	// or roll back together; the binary in storage cannot join it and is
	// removed only after a successful commit.
	if err := db.TransactVoid(ctx, h.db, func(tx *gorm.DB) error {
		repo := repository.NewFactory(tx, h.enforcer).Submission()
		audits := audit.NewWriter(tx)
		if _, err := repo.DeleteAttachment(ctx, attachmentID); err != nil {
			return err
		}
		return h.recordAudit(ctx, audits, input.OrganizationID, item, m, audit.ActionDelete)
	}); err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	if err := h.storage.Remove(m.DataItem.ID); err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}

	return nil, nil
}

func (h *handlers) loadAttachmentForRead(ctx context.Context, input *attachmentInput) (*model.SubmissionAttachment, *model.Submission, error) {
	_, parent, err := h.loadItem(ctx, input.ItemID)
	if err != nil {
		return nil, nil, err
	}
	if err := checkRead(ctx, h.enforcer, input.OrganizationID, parent); err != nil {
		return nil, nil, err
	}
	attachmentID, err := uuid.Parse(input.AttachmentID)
	if err != nil {
		return nil, nil, humax.NewError(http.StatusBadRequest, "invalid attachment_id")
	}
	m, err := h.repo.GetAttachmentByID(ctx, attachmentID)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionAttachmentNotFound) {
			return nil, nil, humax.NewError(http.StatusNotFound, "attachment not found")
		}
		return nil, nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	if m.SubmissionItemID.String() != input.ItemID {
		return nil, nil, humax.NewError(http.StatusNotFound, "attachment not found")
	}
	return m, parent, nil
}
