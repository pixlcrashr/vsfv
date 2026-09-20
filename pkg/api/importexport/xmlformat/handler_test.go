package xmlformat

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2/humatest"
	"github.com/stretchr/testify/require"
)

// TestHumaImportExportRoutes exercises the Huma-registered exception endpoints
// end to end (multipart import + XML export) with auth and permission checks
// disabled (nil deps/enforcer), proving the routes and payload handling work.
func TestHumaImportExportRoutes(t *testing.T) {
	dbConn := setupTestDB(t)
	_, api := humatest.New(t)
	RegisterRoutes(api, dbConn, nil, nil)

	doc := &Document{
		Version: Version,
		Organizations: []Organization{{
			CustomID:    "huma-verein",
			DisplayName: "Huma Verein e.V.",
			Accounts: []Account{
				{ID: "10000000-0000-0000-0000-000000000001", DisplayName: "Root"},
			},
		}},
	}
	data, err := Marshal(doc)
	require.NoError(t, err)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	field, err := writer.CreateFormFile("file", "import.xml")
	require.NoError(t, err)
	_, err = field.Write(data)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	resp := api.Post("/api/v1/organizations:import-xml", bytes.NewReader(body.Bytes()),
		"Content-Type: "+writer.FormDataContentType(),
		"Accept: application/json")
	require.Equal(t, http.StatusCreated, resp.Code, resp.Body.String())

	var imported struct {
		OrganizationID string `json:"organization_id"`
		CustomID       string `json:"custom_id"`
		DisplayName    string `json:"display_name"`
	}
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &imported))
	require.Equal(t, "huma-verein", imported.CustomID)
	require.NotEmpty(t, imported.OrganizationID)

	exported := api.Get("/api/v1/organizations/" + imported.OrganizationID + "/data:export-xml")
	require.Equal(t, http.StatusOK, exported.Code, exported.Body.String())
	require.Contains(t, exported.Header().Get("Content-Type"), "application/xml")
	require.Contains(t, exported.Header().Get("Content-Disposition"), "attachment")
	require.Contains(t, exported.Body.String(), "Huma Verein e.V.")

	missing := api.Get("/api/v1/organizations/00000000-0000-0000-0000-0000000000ff/data:export-xml")
	require.Equal(t, http.StatusNotFound, missing.Code)

	invalid := api.Get("/api/v1/organizations/not-a-uuid/data:export-xml")
	require.Equal(t, http.StatusBadRequest, invalid.Code)
}
