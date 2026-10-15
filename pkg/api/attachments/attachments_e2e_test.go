package attachments

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"testing"

	"github.com/danielgtaylor/huma/v2/humatest"
	"github.com/google/uuid"
	"github.com/ory/fosite"
	"github.com/stretchr/testify/require"

	"github.com/pixlcrashr/vsfv/pkg/api/humax"
	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/auth"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/storage"
)

// stubOAuth2 satisfies the auth plumbing with a fixed subject and scopes so
// the endpoint chain can be exercised without a running OAuth2 server. Every
// presented token authenticates as SystemUserID.
type stubOAuth2 struct {
	fosite.OAuth2Provider

	subject uuid.UUID
}

func (s *stubOAuth2) IntrospectToken(ctx context.Context, token string, tokenUse fosite.TokenType, session fosite.Session, scopes ...string) (fosite.TokenUse, fosite.AccessRequester, error) {
	if token == "" {
		return "", nil, fosite.ErrInactiveToken
	}
	session = auth.NewSession(&model.User{ID: s.subject})
	ar := fosite.NewAccessRequest(session)
	ar.GrantScope(authz.ScopeSubmissionsRead)
	ar.GrantScope(authz.ScopeSubmissionsWrite)
	return fosite.AccessToken, ar, nil
}

// TestSystemUserAttachmentCRUD is the end-to-end regression for the reported
// issue: a user in the seeded "system" group must be able to upload, read and
// delete submission attachments. The input structs previously embedded an
// unexported type, which made Huma drop the Authorization header and path
// parameters from the create/get/download/delete routes, so every request
// failed with 401 regardless of the caller's permissions.
func TestSystemUserAttachmentCRUD(t *testing.T) {
	f, err := os.CreateTemp("", "vsfv-attachments-e2e-*.sqlite")
	require.NoError(t, err)
	require.NoError(t, f.Close())
	defer func() { _ = os.Remove(f.Name()) }()

	gormDB, err := db.ConnectSilent("sqlite://" + f.Name())
	require.NoError(t, err)
	sqlDB, err := gormDB.DB()
	require.NoError(t, err)
	defer func() { _ = sqlDB.Close() }()
	require.NoError(t, db.Run(sqlDB))

	enforcer, err := authz.NewEnforcer(gormDB)
	require.NoError(t, err)
	require.NoError(t, authz.SeedSystemGroup(context.Background(), gormDB, enforcer))

	// A user in the system group (casbin g2 → wildcard policy).
	systemUserID := uuid.New()
	var systemGroup model.UserGroup
	require.NoError(t, gormDB.Where("custom_id = ?", authz.SystemGroupCustomID).First(&systemGroup).Error)
	_, err = enforcer.AddGlobalGroupingPolicy(systemUserID.String(), systemGroup.ID.String())
	require.NoError(t, err)

	// Fixture: organization, committee, draft submission owned by the system
	// user, and one item to attach to.
	org := &model.Organization{CustomID: "testorg", DisplayName: "Test Org"}
	require.NoError(t, gormDB.Create(org).Error)
	committee := &model.Committee{CustomID: "committee-1", OrganizationID: org.ID, DisplayName: "Test Committee"}
	require.NoError(t, gormDB.Create(committee).Error)
	sub := &model.Submission{
		OrganizationID:  org.ID,
		CustomID:        "sub-1",
		CreatedByUserID: systemUserID,
		CommitteeID:     committee.ID,
		Type:            model.SubmissionTypeIncomeExpense,
		Scope:           model.SubmissionScopeNonprofit,
		Status:          model.SubmissionStatusDraft,
	}
	require.NoError(t, gormDB.Create(sub).Error)
	item := &model.SubmissionItem{SubmissionID: sub.ID}
	require.NoError(t, gormDB.Create(item).Error)

	fileStorage, err := storage.NewFileStorage(t.TempDir())
	require.NoError(t, err)

	_, api := humatest.New(t)
	RegisterRoutes(api, gormDB, &Deps{
		Auth: &humax.AuthDeps{
			OAuth2:         &stubOAuth2{subject: systemUserID},
			SessionFactory: func() fosite.Session { return auth.NewSession(nil) },
		},
		Enforcer: enforcer,
		Storage:  fileStorage,
		Audits:   audit.NewWriter(gormDB),
	})

	base := "/api/v1/organizations/" + org.CustomID + "/submissions/" + sub.ID.String() + "/items/" + item.ID.String() + "/attachments"

	// ── create ────────────────────────────────────────────────────────────
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	partHeader := textproto.MIMEHeader{}
	partHeader.Set("Content-Disposition", `form-data; name="file"; filename="receipt.pdf"`)
	partHeader.Set("Content-Type", "application/pdf")
	fh, err := w.CreatePart(partHeader)
	require.NoError(t, err)
	_, err = fh.Write([]byte("%PDF-1.4 test"))
	require.NoError(t, err)
	require.NoError(t, w.Close())

	resp := api.Post(base, bytes.NewReader(body.Bytes()),
		"Content-Type: "+w.FormDataContentType(),
		"Authorization: Bearer stub-token")
	require.Equal(t, http.StatusCreated, resp.Code, resp.Body.String())

	var created attachmentBody
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &created))
	require.Equal(t, "receipt.pdf", created.FileName)
	require.NotEmpty(t, created.ID)

	// ── list ──────────────────────────────────────────────────────────────
	resp = api.Get(base, "Authorization: Bearer stub-token")
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())
	require.Contains(t, resp.Body.String(), created.ID)

	// ── get ───────────────────────────────────────────────────────────────
	resp = api.Get(base+"/"+created.ID, "Authorization: Bearer stub-token")
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())

	// ── download ──────────────────────────────────────────────────────────
	resp = api.Get(base+"/"+created.ID+"/download", "Authorization: Bearer stub-token")
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())
	require.Equal(t, "application/pdf", resp.Header().Get("Content-Type"))
	require.Equal(t, "%PDF-1.4 test", resp.Body.String())

	// ── delete ────────────────────────────────────────────────────────────
	resp = api.Delete(base+"/"+created.ID, "Authorization: Bearer stub-token")
	require.Equal(t, http.StatusNoContent, resp.Code, resp.Body.String())

	resp = api.Get(base, "Authorization: Bearer stub-token")
	require.Equal(t, http.StatusOK, resp.Code, resp.Body.String())
	require.NotContains(t, resp.Body.String(), created.ID)
}
