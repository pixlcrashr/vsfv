// Package attachments serves submission item attachments (binary files) via
// Huma-hosted exception endpoints. The binary transfer deliberately lives
// outside the protobuf-generated API; metadata is exposed as JSON and the
// bytes through a /download sub-path (Fiber cannot parse AIP-style
// `{param}:verb` suffixes within a single path segment).
package attachments

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/api/humax"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
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

var mimeExtensions = map[string]string{
	"application/pdf": ".pdf",
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
}

// Deps bundles everything the attachment endpoints need.
type Deps struct {
	Auth        *humax.AuthDeps
	Enforcer    *authz.Enforcer
	StoragePath string
}

// RegisterRoutes wires the attachment endpoints onto the given Huma API. The
// routes must be registered before the grpc-gateway's /api/v1/* catch-all.
func RegisterRoutes(api huma.API, db *gorm.DB, deps *Deps) {
	h := &handlers{
		repo:        repository.NewSubmissionRepository(db),
		auth:        deps.Auth,
		enforcer:    deps.Enforcer,
		storagePath: deps.StoragePath,
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
	repo        *repository.SubmissionRepository
	auth        *humax.AuthDeps
	enforcer    *authz.Enforcer
	storagePath string
}

// Attachment metadata as returned by the JSON endpoints.
type attachmentBody struct {
	ID               string `json:"id"`
	SubmissionItemID string `json:"submission_item_id"`
	FileName         string `json:"file_name"`
	MimeType         string `json:"mime_type"`
	FileSize         int64  `json:"file_size"`
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

type listInput struct {
	Authorization  string `header:"Authorization" doc:"Bearer access token"`
	OrganizationID string `path:"organization_id"`
	SubmissionID   string `path:"submission_id"`
	ItemID         string `path:"item_id"`
}

type attachmentInput struct {
	listInput
	AttachmentID string `path:"attachment_id"`
}

type createInput struct {
	listInput
	RawBody multipart.Form
}

func (h *handlers) toBody(m *model.SubmissionAttachment) attachmentBody {
	return attachmentBody{
		ID:               m.ID.String(),
		SubmissionItemID: m.SubmissionItemID.String(),
		FileName:         m.FileName,
		MimeType:         m.MimeType,
		FileSize:         m.FileSize,
		CreateTime:       m.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	}
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

	attachmentID := uuid.New()
	ext := mimeExtensions[mimeType]
	key := attachmentID.String() + ext
	path := filepath.Join(h.storagePath, key)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	out, err := os.Create(path)
	if err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	defer out.Close()
	written, err := io.Copy(out, io.LimitReader(file, maxAttachmentSize+1))
	if err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	if written > maxAttachmentSize {
		_ = os.Remove(path)
		return nil, humax.NewError(http.StatusUnprocessableEntity, "file exceeds the 10 MiB limit")
	}

	m := &model.SubmissionAttachment{
		ID:               attachmentID,
		SubmissionItemID: item.ID,
		FileName:         filepath.Base(fh.Filename),
		MimeType:         mimeType,
		FileSize:         written,
		StorageKey:       key,
	}
	if err := h.repo.CreateAttachment(ctx, m); err != nil {
		_ = os.Remove(path)
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}

	return &attachmentOutput{Body: h.toBody(m)}, nil
}

func (h *handlers) list(ctx context.Context, input *listInput) (*attachmentListOutput, error) {
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

	data, err := os.ReadFile(filepath.Join(h.storagePath, m.StorageKey))
	if err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}

	return &downloadOutput{
		Body:               data,
		ContentType:        m.MimeType,
		ContentDisposition: fmt.Sprintf("attachment; filename=\"%s\"", m.FileName),
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

	if _, err := h.repo.DeleteAttachment(ctx, attachmentID); err != nil {
		return nil, humax.NewError(http.StatusInternalServerError, "internal error")
	}
	if err := os.Remove(filepath.Join(h.storagePath, m.StorageKey)); err != nil && !os.IsNotExist(err) {
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
