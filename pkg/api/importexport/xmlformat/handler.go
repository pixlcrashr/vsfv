package xmlformat

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gofiber/adaptor/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

// maxXMLSize bounds XML import uploads (and the multipart memory buffer).
const maxXMLSize = 32 << 20

const (
	exportPathPrefix = "/api/v1/organizations/"
	exportPathSuffix = "/data:export-xml"
)

// RegisterRoutes wires the XML import/export endpoints onto the given Fiber
// app. Import creates a new organization from an uploaded document; export
// downloads an existing organization. Both are organization-administration
// operations guarded by global organization permissions. The handlers are
// implemented in net/http so they can share the Bearer-token auth middleware
// with the grpc-gateway API; they must be registered before the gateway's
// /api/v1/* catch-all (api.Server does so).
func RegisterRoutes(app fiber.Router, db *gorm.DB, authMiddleware func(http.Handler) http.Handler, enforcer *authz.Enforcer) {
	deps := makeExportRepositoryDependencies(db)

	app.Post("/api/v1/organizations:import-xml",
		adaptor.HTTPHandler(withAuth(authMiddleware, handleImportXML(db, enforcer))))
	app.Get("/api/v1/organizations/:organization_id/data:export-xml",
		adaptor.HTTPHandler(withAuth(authMiddleware, handleExportXML(deps, enforcer))))
}

// withAuth applies the auth middleware when one is configured (it is nil when
// the auth server is disabled).
func withAuth(authMiddleware func(http.Handler) http.Handler, h http.Handler) http.Handler {
	if authMiddleware == nil {
		return h
	}
	return authMiddleware(h)
}

// handleImportXML accepts a multipart upload (field "file") containing a V1
// XML document and imports it as a new organization.
func handleImportXML(db *gorm.DB, enforcer *authz.Enforcer) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !requireGlobalPermission(w, r, enforcer, authz.ResourceOrganizations, authz.ActionCreate) {
			return
		}

		if err := r.ParseMultipartForm(maxXMLSize); err != nil {
			writeHTTPError(w, http.StatusBadRequest, "invalid multipart form: "+err.Error())
			return
		}
		file, _, err := r.FormFile("file")
		if err != nil {
			writeHTTPError(w, http.StatusBadRequest, "missing file field")
			return
		}
		defer file.Close()

		data, err := io.ReadAll(io.LimitReader(file, maxXMLSize))
		if err != nil {
			writeHTTPError(w, http.StatusBadRequest, "cannot read uploaded file")
			return
		}

		doc, err := Unmarshal(data)
		if err != nil {
			writeHTTPError(w, http.StatusUnprocessableEntity, fmt.Sprintf("invalid xml: %v", err))
			return
		}

		org, err := ImportNewOrganization(r.Context(), db, doc)
		switch {
		case errors.Is(err, ErrOrganizationCustomIDTaken):
			writeHTTPError(w, http.StatusConflict, err.Error())
		case err != nil:
			writeHTTPError(w, http.StatusUnprocessableEntity, err.Error())
		default:
			writeJSON(w, http.StatusCreated, map[string]string{
				"organization_id": org.ID.String(),
				"custom_id":       org.CustomID,
				"display_name":    org.DisplayName,
			})
		}
	})
}

// handleExportXML streams an existing organization as a V1 XML document. The
// organization ID is taken from the request path because the handler runs as a
// plain net/http handler behind the Fiber adaptor, which has no path-param
// support.
func handleExportXML(deps *ExportRepositoryDependencies, enforcer *authz.Enforcer) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !requireGlobalPermission(w, r, enforcer, authz.ResourceOrganizations, authz.ActionRead) {
			return
		}

		orgID, err := parseExportOrganizationID(r.URL.Path)
		if err != nil {
			writeHTTPError(w, http.StatusBadRequest, "invalid organization_id")
			return
		}

		doc, err := ExportOrganization(r.Context(), deps, orgID)
		if errors.Is(err, repository.ErrOrganizationNotFound) {
			writeHTTPError(w, http.StatusNotFound, "organization not found")
			return
		}
		if err != nil {
			writeHTTPError(w, http.StatusInternalServerError, err.Error())
			return
		}

		data, err := Marshal(doc)
		if err != nil {
			writeHTTPError(w, http.StatusInternalServerError, err.Error())
			return
		}

		w.Header().Set("Content-Type", "application/xml; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"vsfv-export-%s.xml\"", orgID))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
	})
}

// parseExportOrganizationID extracts the organization UUID from an export
// request path of the form /api/v1/organizations/{uuid}/data:export-xml.
func parseExportOrganizationID(path string) (uuid.UUID, error) {
	if !strings.HasPrefix(path, exportPathPrefix) || !strings.HasSuffix(path, exportPathSuffix) {
		return uuid.Nil, fmt.Errorf("unexpected export path %q", path)
	}
	id := strings.TrimSuffix(strings.TrimPrefix(path, exportPathPrefix), exportPathSuffix)
	return uuid.Parse(id)
}

// requireGlobalPermission reports whether the request may proceed and otherwise
// writes the matching error response. A nil enforcer disables the check (used
// by tests).
func requireGlobalPermission(w http.ResponseWriter, r *http.Request, enforcer *authz.Enforcer, resource, action string) bool {
	if enforcer == nil {
		return true
	}
	err := authz.CheckGlobal(r.Context(), enforcer, resource, action)
	if err == nil {
		return true
	}
	if errors.Is(err, authz.ErrUnauthenticated) {
		writeHTTPError(w, http.StatusUnauthorized, err.Error())
	} else {
		writeHTTPError(w, http.StatusForbidden, err.Error())
	}
	return false
}

func writeHTTPError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func makeExportRepositoryDependencies(db *gorm.DB) *ExportRepositoryDependencies {
	return &ExportRepositoryDependencies{
		OrganizationRepo:               repository.NewOrganizationRepository(db),
		AccountRepo:                    repository.NewAccountRepository(db),
		AccountGroupRepo:               repository.NewAccountGroupRepository(db),
		AccountGroupAssignmentRepo:     repository.NewAccountGroupAssignmentRepository(db),
		BudgetRepo:                     repository.NewBudgetRepository(db),
		BudgetAccountValueRepo:         repository.NewBudgetAccountValueRepository(db),
		BudgetRevisionRepo:             repository.NewBudgetRevisionRepository(db),
		BudgetRevisionAccountValueRepo: repository.NewBudgetRevisionAccountValueRepository(db),
		LedgerAccountRepo:              repository.NewLedgerAccountRepository(db),
		LedgerYearRepo:                 repository.NewLedgerYearRepository(db),
		TransactionRepo:                repository.NewTransactionRepository(db),
		TransactionAssignmentRepo:      repository.NewTransactionAssignmentRepository(db),
	}
}
