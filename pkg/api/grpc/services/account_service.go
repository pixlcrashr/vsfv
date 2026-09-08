package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"go.einride.tech/aip/ordering"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var (
	statusAccountRequired                  = status.New(codes.InvalidArgument, "account is required")
	statusInvalidAccountName               = status.New(codes.InvalidArgument, "invalid account name")
	statusInvalidOrganizationInAccountName = status.New(codes.InvalidArgument, "invalid organization in account name")
	statusInvalidParentAccount             = status.New(codes.InvalidArgument, "invalid parent_account")
	statusInvalidParentAccountOrganization = status.New(codes.InvalidArgument, "invalid parent_account organization")
	statusParentAccountMustBeContainer     = status.New(codes.InvalidArgument, "parent account must be a container account")
	statusParentAccountNotFound            = status.New(codes.NotFound, "parent account not found")
	statusParentAccountArchived            = status.New(codes.FailedPrecondition, "parent account is archived, restore the parent first")
	statusAccountAlreadyExists             = status.New(codes.AlreadyExists, "account with this ID already exists")
	statusFailedGetAccount                 = status.New(codes.Internal, "failed to get account")
	statusFailedGetParentAccount           = status.New(codes.Internal, "failed to get parent account")
	statusFailedListAccounts               = status.New(codes.Internal, "failed to list accounts")
	statusFailedCreateAccount              = status.New(codes.Internal, "failed to create account")
	statusFailedUpdateAccount              = status.New(codes.Internal, "failed to update account")
	statusFailedArchiveAccount             = status.New(codes.Internal, "failed to archive account")
	statusFailedRestoreAccount             = status.New(codes.Internal, "failed to restore account")
)

type accountServiceServer struct {
	gen.UnimplementedAccountServiceServer
	repo     *repository.AccountRepository
	audits   *auditWriter
	enforcer *authz.Enforcer
}

func newAccountServiceServer(repo *repository.AccountRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.AccountServiceServer {
	return &accountServiceServer{repo: repo, audits: audits, enforcer: enforcer}
}

func (s *accountServiceServer) GetAccount(ctx context.Context, req *gen.GetAccountRequest) (*gen.Account, error) {
	var n gen.AccountResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccounts, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInAccountName}
	}

	// Use CustomID (n.Account) instead of parsing as UUID
	m, err := s.repo.GetByCustomID(ctx, orgID, n.Account)
	if err != nil {
		if errors.Is(err, repository.ErrAccountNotFound) {
			return nil, &ServerError{Err: err, Status: statusAccountNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetAccount}
	}

	var parentM *model.Account
	if m.ParentAccountID.Valid {
		parentM, err = s.repo.GetByID(ctx, m.ParentAccountID.UUID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetParentAccount}
		}
	}
	return AccountToProto(gen.OrganizationResourceName{Organization: n.Organization}, m, parentM), nil
}

func (s *accountServiceServer) ListAccounts(ctx context.Context, req *gen.ListAccountsRequest) (*gen.ListAccountsResponse, error) {
	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccounts, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	c, err := svcfilter.ParseAccountFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	offset, err := pagetoken.Decode(req.PageToken)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidPageToken}
	}

	pageSize := normalizePageSize(req.PageSize)

	// Parse order_by
	orderBy, err := ordering.ParseOrderBy(req)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrderBy}
	}

	orderExprs, _ := order.Resolve(orderBy, repository.AccountOrderFieldMapper)

	params := repository.ListAccountsParams{
		OrganizationID: orgID,
		Page:           int(offset/int64(pageSize)) + 1,
		PageSize:       pageSize,
		Cond:           c,
		OrderBy:        orderExprs,
	}

	ms, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListAccounts}
	}

	// Batch-fetch any parent accounts referenced by the listed accounts so
	// that the response can populate parent_account for each child.
	parentIDs := make([]uuid.UUID, 0, len(ms))
	parentIDSet := make(map[uuid.UUID]struct{}, len(ms))
	for _, m := range ms {
		if !m.ParentAccountID.Valid {
			continue
		}
		if _, ok := parentIDSet[m.ParentAccountID.UUID]; ok {
			continue
		}
		parentIDSet[m.ParentAccountID.UUID] = struct{}{}
		parentIDs = append(parentIDs, m.ParentAccountID.UUID)
	}

	parentByID := make(map[uuid.UUID]*model.Account)
	if len(parentIDs) > 0 {
		parents, err := s.repo.GetByIDs(ctx, parentIDs)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetParentAccount}
		}
		for _, p := range parents {
			parentByID[p.ID] = p
		}
	}

	resp := &gen.ListAccountsResponse{TotalSize: total}
	for _, m := range ms {
		var parentM *model.Account
		if m.ParentAccountID.Valid {
			parentM = parentByID[m.ParentAccountID.UUID]
		}
		resp.Accounts = append(resp.Accounts, AccountToProto(pn, m, parentM))
	}

	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}

	return resp, nil
}

func (s *accountServiceServer) ListNestedAccounts(ctx context.Context, req *gen.ListNestedAccountsRequest) (*gen.ListNestedAccountsResponse, error) {
	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccounts, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	c, err := svcfilter.ParseAccountFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	params := repository.ListAccountsParams{
		OrganizationID: orgID,
		Page:           1,
		PageSize:       1000,
		Cond:           c,
	}

	ms, _, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListAccounts}
	}

	return &gen.ListNestedAccountsResponse{
		Accounts: buildNestedTree(pn, ms, uuid.NullUUID{}),
	}, nil
}

func (s *accountServiceServer) GetNestedAccount(ctx context.Context, req *gen.GetNestedAccountRequest) (*gen.GetNestedAccountResponse, error) {
	var n gen.AccountResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccounts, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInAccountName}
	}

	// Use CustomID (n.Account) instead of parsing as UUID
	root, err := s.repo.GetByCustomID(ctx, orgID, n.Account)
	if err != nil {
		if errors.Is(err, repository.ErrAccountNotFound) {
			return nil, &ServerError{Err: err, Status: statusAccountNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetAccount}
	}

	ms, _, err := s.repo.List(ctx, repository.ListAccountsParams{Page: 1, PageSize: 10000})
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListAccounts}
	}

	rootNested := NestedAccountToProto(n.OrganizationResourceName(), root, nil)
	rootNested.Children = buildNestedTree(n.OrganizationResourceName(), ms, uuid.NullUUID{Valid: true, UUID: root.ID})

	return &gen.GetNestedAccountResponse{Account: rootNested}, nil
}

func (s *accountServiceServer) CreateAccount(ctx context.Context, req *gen.CreateAccountRequest) (*gen.Account, error) {
	if req.Account == nil {
		return nil, &ServerError{Status: statusAccountRequired}
	}

	var n gen.OrganizationResourceName

	if err := n.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccounts, authz.ActionCreate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	parentAccountID := uuid.NullUUID{}
	var parent *model.Account

	if req.Account.ParentAccount != "" {
		var pn gen.AccountResourceName

		if err := pn.UnmarshalString(req.Account.ParentAccount); err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidParentAccount}
		}

		parentOrgID, err := uuid.Parse(pn.Organization)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidParentAccountOrganization}
		}

		// Use CustomID (pn.Account) instead of parsing as UUID
		parent, err = s.repo.GetByCustomID(ctx, parentOrgID, pn.Account)
		if err != nil {
			if errors.Is(err, repository.ErrAccountNotFound) {
				return nil, &ServerError{Err: err, Status: statusParentAccountNotFound}
			}

			return nil, &ServerError{Err: err, Status: statusFailedGetParentAccount}
		}

		if !parent.IsContainer {
			return nil, &ServerError{Status: statusParentAccountMustBeContainer}
		}

		parentAccountID = uuid.NullUUID{Valid: true, UUID: parent.ID}
	}

	m, err := s.repo.Create(ctx, repository.CreateAccountParams{
		OrganizationID:     orgID,
		ParentAccountID:    parentAccountID,
		DisplayName:        req.Account.DisplayName,
		DisplayCode:        req.Account.DisplayCode,
		DisplayDescription: req.Account.DisplayDescription,
		IsContainer:        req.Account.IsContainer,
		CustomID:           req.AccountId,
	})
	if err != nil {
		if errors.Is(err, repository.ErrAccountAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusAccountAlreadyExists}
		}

		if errors.Is(err, repository.ErrOrganizationNotFound) {
			return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedCreateAccount}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.AccountResourceName(m.CustomID).String(), orgID, m.ID,
	), AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return AccountToProto(n, m, parent), nil
}

func (s *accountServiceServer) UpdateAccount(ctx context.Context, req *gen.UpdateAccountRequest) (*gen.Account, error) {
	if req.Account == nil {
		return nil, &ServerError{Status: statusAccountRequired}
	}

	var n gen.AccountResourceName

	if err := n.UnmarshalString(req.Account.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccounts, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInAccountName}
	}

	// Use CustomID (n.Account) instead of parsing as UUID
	m, err := s.repo.GetByCustomID(ctx, orgID, n.Account)
	if err != nil {
		if errors.Is(err, repository.ErrAccountNotFound) {
			return nil, &ServerError{Err: err, Status: statusAccountNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetAccount}
	}

	before := *m

	updateParams := repository.UpdateAccountParams{
		DisplayName:        optional.From(req.Account.DisplayName),
		DisplayCode:        optional.From(req.Account.DisplayCode),
		DisplayDescription: optional.From(req.Account.DisplayDescription),
		IsContainer:        optional.From(req.Account.IsContainer),
	}

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateAccount}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateAccount}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	var parentM *model.Account
	if m.ParentAccountID.Valid {
		parentM, err = s.repo.GetByID(ctx, m.ParentAccountID.UUID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetParentAccount}
		}
	}
	return AccountToProto(gen.OrganizationResourceName{Organization: n.Organization}, m, parentM), nil
}

func (s *accountServiceServer) ArchiveAccount(ctx context.Context, req *gen.ArchiveAccountRequest) (*gen.Account, error) {
	var n gen.AccountResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccounts, authz.ActionArchive, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInAccountName}
	}

	// Use CustomID (n.Account) instead of parsing as UUID
	m, err := s.repo.GetByCustomID(ctx, orgID, n.Account)
	if err != nil {
		if errors.Is(err, repository.ErrAccountNotFound) {
			return nil, &ServerError{Err: err, Status: statusAccountNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetAccount}
	}

	before := *m

	updateParams := repository.UpdateAccountParams{
		IsArchived: optional.From(true),
	}

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedArchiveAccount}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedArchiveAccount}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	var parentM *model.Account
	if m.ParentAccountID.Valid {
		parentM, err = s.repo.GetByID(ctx, m.ParentAccountID.UUID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetParentAccount}
		}
	}
	return AccountToProto(gen.OrganizationResourceName{Organization: n.Organization}, m, parentM), nil
}

func (s *accountServiceServer) RestoreAccount(ctx context.Context, req *gen.RestoreAccountRequest) (*gen.Account, error) {
	var n gen.AccountResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceAccounts, authz.ActionRestore, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInAccountName}
	}

	// Use CustomID (n.Account) instead of parsing as UUID
	m, err := s.repo.GetByCustomID(ctx, orgID, n.Account)
	if err != nil {
		if errors.Is(err, repository.ErrAccountNotFound) {
			return nil, &ServerError{Err: err, Status: statusAccountNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetAccount}
	}

	// An account cannot be restored while its parent is still archived.
	// Restoring must happen top-down: restore the parent first.
	if m.ParentAccountID.Valid {
		parent, err := s.repo.GetByID(ctx, m.ParentAccountID.UUID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetParentAccount}
		}

		if parent.IsArchived {
			return nil, &ServerError{Status: statusParentAccountArchived}
		}
	}

	before := *m

	if err := s.repo.Update(ctx, m.ID, repository.UpdateAccountParams{
		IsArchived: optional.From(false),
	}); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRestoreAccount}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRestoreAccount}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	var parentM *model.Account
	if m.ParentAccountID.Valid {
		parentM, err = s.repo.GetByID(ctx, m.ParentAccountID.UUID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetParentAccount}
		}
	}
	return AccountToProto(gen.OrganizationResourceName{Organization: n.Organization}, m, parentM), nil
}

type accountWithChildren struct {
	account  *model.Account
	children []*accountWithChildren
}

// buildNestedTree recursively assembles NestedAccount trees.
// parentID selects which accounts to treat as roots (empty = top-level roots).
func buildNestedTree(orgRN gen.OrganizationResourceName, as []*model.Account, parentID uuid.NullUUID) []*gen.NestedAccount {
	rAll := make([]*accountWithChildren, len(as))
	asToACs := make(map[string]*accountWithChildren, 0)
	rs := make([]*accountWithChildren, 0)

	for i, a := range as {
		a := &accountWithChildren{
			account:  a,
			children: nil,
		}
		rAll[i] = a
		asToACs[a.account.ID.String()] = a

		if !a.account.ParentAccountID.Valid {
			rs = append(rs, a)
		}
	}

	for len(as) > 0 {
		a := as[0]
		as = as[1:]

		aC, ok := asToACs[a.ID.String()]
		if !ok {
			continue
		}

		if !a.ParentAccountID.Valid {
			continue
		}

		var p *accountWithChildren
		for _, r := range rAll {
			if r.account.ID == a.ParentAccountID.UUID {
				p = r
				break
			}
		}

		if p == nil {
			continue
		}

		p.children = append(p.children, aC)
	}

	return NestedAccountsToProto(orgRN, rs)
}
