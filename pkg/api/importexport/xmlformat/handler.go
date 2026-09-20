package xmlformat

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/pixlcrashr/vsfv/pkg/api/humax"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

// maxXMLSize bounds XML import uploads (and the multipart memory buffer).
const maxXMLSize = 32 << 20

// RegisterRoutes wires the XML import/export endpoints onto the given Huma
// API. Import creates a new organization from an uploaded document; export
// downloads an existing organization. Both are organization-administration
// operations guarded by global organization permissions.
//
// These routes live outside the protobuf-generated gRPC-gateway API as
// Huma-hosted exception endpoints (self-documented via Huma's OpenAPI) and
// must be registered before the gateway's /api/v1/* catch-all (api.Server
// does so).
func RegisterRoutes(api huma.API, db *gorm.DB, authDeps *humax.AuthDeps, enforcer *authz.Enforcer) {
	deps := makeExportRepositoryDependencies(db)

	huma.Register(api, huma.Operation{
		OperationID:   "import-organization-xml",
		Method:        http.MethodPost,
		Path:          "/api/v1/organizations:import-xml",
		Summary:       "Import an organization from a V1 XML document",
		Description:   "Creates a new organization from an uploaded V1 XML document (multipart field \"file\").",
		Tags:          []string{"Import/Export"},
		MaxBodyBytes:  maxXMLSize,
		DefaultStatus: http.StatusCreated,
	}, func(ctx context.Context, input *importInput) (*importOutput, error) {
		authed, err := humax.Auth(ctx, authDeps, input.Authorization)
		if err != nil {
			return nil, err
		}
		if err := humax.CheckGlobal(authed, enforcer, authz.ResourceOrganizations, authz.ActionCreate); err != nil {
			return nil, err
		}

		file, err := openUploadedFile(&input.RawBody)
		if err != nil {
			return nil, err
		}
		defer file.Close()

		data, err := io.ReadAll(io.LimitReader(file, maxXMLSize))
		if err != nil {
			return nil, humax.NewError(http.StatusBadRequest, "cannot read uploaded file")
		}

		doc, err := Unmarshal(data)
		if err != nil {
			return nil, humax.NewError(http.StatusUnprocessableEntity, fmt.Sprintf("invalid xml: %v", err))
		}

		org, err := ImportNewOrganization(authed, db, doc)
		switch {
		case errors.Is(err, ErrOrganizationCustomIDTaken):
			return nil, humax.NewError(http.StatusConflict, err.Error())
		case err != nil:
			return nil, humax.NewError(http.StatusUnprocessableEntity, err.Error())
		}

		return &importOutput{Body: importBody{
			OrganizationID: org.ID.String(),
			CustomID:       org.CustomID,
			DisplayName:    org.DisplayName,
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "export-organization-xml",
		Method:      http.MethodGet,
		Path:        "/api/v1/organizations/{organization_id}/data:export-xml",
		Summary:     "Export an organization as a V1 XML document",
		Description: "Downloads the organization as a V1 XML document.",
		Tags:        []string{"Import/Export"},
	}, func(ctx context.Context, input *exportInput) (*exportOutput, error) {
		authed, err := humax.Auth(ctx, authDeps, input.Authorization)
		if err != nil {
			return nil, err
		}
		if err := humax.CheckGlobal(authed, enforcer, authz.ResourceOrganizations, authz.ActionRead); err != nil {
			return nil, err
		}

		orgID, err := uuid.Parse(input.OrganizationID)
		if err != nil {
			return nil, humax.NewError(http.StatusBadRequest, "invalid organization_id")
		}

		doc, err := ExportOrganization(authed, deps, orgID)
		if errors.Is(err, repository.ErrOrganizationNotFound) {
			return nil, humax.NewError(http.StatusNotFound, "organization not found")
		}
		if err != nil {
			return nil, humax.NewError(http.StatusInternalServerError, err.Error())
		}

		data, err := Marshal(doc)
		if err != nil {
			return nil, humax.NewError(http.StatusInternalServerError, err.Error())
		}

		return &exportOutput{
			Body:               data,
			ContentType:        "application/xml; charset=utf-8",
			ContentDisposition: fmt.Sprintf("attachment; filename=\"vsfv-export-%s.xml\"", orgID),
		}, nil
	})
}

type importInput struct {
	Authorization string `header:"Authorization" doc:"Bearer access token"`
	RawBody       multipart.Form
}

type importBody struct {
	OrganizationID string `json:"organization_id"`
	CustomID       string `json:"custom_id"`
	DisplayName    string `json:"display_name"`
}

type importOutput struct {
	Body importBody
}

type exportInput struct {
	Authorization  string `header:"Authorization" doc:"Bearer access token"`
	OrganizationID string `path:"organization_id"`
}

type exportOutput struct {
	Body               []byte
	ContentType        string `header:"Content-Type"`
	ContentDisposition string `header:"Content-Disposition"`
}

// openUploadedFile extracts the multipart form field "file".
func openUploadedFile(form *multipart.Form) (multipart.File, error) {
	headers := form.File["file"]
	if len(headers) == 0 {
		return nil, humax.NewError(http.StatusBadRequest, "missing file field")
	}
	return headers[0].Open()
}
