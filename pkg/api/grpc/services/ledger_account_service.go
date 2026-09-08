package services

import (
	"context"
	"errors"
	"fmt"

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
	"google.golang.org/protobuf/types/known/emptypb"
)

var (
	statusLedgerAccountRequired     = status.New(codes.InvalidArgument, "ledger_account is required")
	statusInvalidLedgerAccountName  = status.New(codes.InvalidArgument, "invalid ledger account name")
	statusFailedGetLedgerAccount    = status.New(codes.Internal, "failed to get ledger account")
	statusFailedListLedgerAccounts  = status.New(codes.Internal, "failed to list ledger accounts")
	statusFailedUpdateLedgerAccount = status.New(codes.Internal, "failed to update ledger account")
	statusFailedDeleteLedgerAccount = status.New(codes.Internal, "failed to delete ledger account")
)

type ledgerAccountServiceServer struct {
	gen.UnimplementedLedgerAccountServiceServer
	repo     *repository.LedgerAccountRepository
	audits   *auditWriter
	enforcer *authz.Enforcer
}

func newLedgerAccountServiceServer(repo *repository.LedgerAccountRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.LedgerAccountServiceServer {
	return &ledgerAccountServiceServer{repo: repo, audits: audits, enforcer: enforcer}
}

func (s *ledgerAccountServiceServer) GetLedgerAccount(ctx context.Context, req *gen.GetLedgerAccountRequest) (*gen.LedgerAccount, error) {
	var n gen.LedgerAccountResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidLedgerAccountName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceLedgerAccount, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInLedgerAccountName}
	}

	// Use CustomID (n.LedgerAccount) instead of parsing as UUID
	m, err := s.repo.GetByCustomID(ctx, orgID, n.LedgerAccount)
	if err != nil {
		if errors.Is(err, repository.ErrLedgerAccountNotFound) {
			return nil, &ServerError{Err: err, Status: statusLedgerAccountNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetLedgerAccount}
	}

	return LedgerAccountToProto(n.OrganizationResourceName(), m), nil
}

func (s *ledgerAccountServiceServer) BatchGetLedgerAccounts(ctx context.Context, req *gen.BatchGetLedgerAccountsRequest) (*gen.BatchGetLedgerAccountsResponse, error) {
	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceLedgerAccount, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInLedgerAccountName}
	}

	customIDs := make([]string, 0, len(req.Names))
	for _, name := range req.Names {
		var n gen.LedgerAccountResourceName
		if err := n.UnmarshalString(name); err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidLedgerAccountName}
		}
		customIDs = append(customIDs, n.LedgerAccount)
	}

	ms, err := s.repo.BatchGetByCustomID(ctx, orgID, customIDs)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedBatchGetLedgerAccounts}
	}

	resp := &gen.BatchGetLedgerAccountsResponse{}
	for i, m := range ms {
		if m == nil {
			return nil, &ServerError{Err: fmt.Errorf("ledger account not found: %s", req.Names[i]), Status: statusLedgerAccountNotFound}
		}
		resp.LedgerAccounts = append(resp.LedgerAccounts, LedgerAccountToProto(pn, m))
	}
	return resp, nil
}

func (s *ledgerAccountServiceServer) ListLedgerAccounts(ctx context.Context, req *gen.ListLedgerAccountsRequest) (*gen.ListLedgerAccountsResponse, error) {
	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceLedgerAccount, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	c, err := svcfilter.ParseLedgerAccountFilter(req.Filter)
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

	orderExprs, _ := order.Resolve(orderBy, repository.LedgerAccountOrderFieldMapper)

	params := repository.ListLedgerAccountsParams{
		Page:     int(offset/int64(pageSize)) + 1,
		PageSize: pageSize,
		Cond:     c,
		OrderBy:  orderExprs,
	}

	ms, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListLedgerAccounts}
	}

	resp := &gen.ListLedgerAccountsResponse{TotalSize: total}
	for _, m := range ms {
		resp.LedgerAccounts = append(resp.LedgerAccounts, LedgerAccountToProto(pn, m))
	}

	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}

	return resp, nil
}

func (s *ledgerAccountServiceServer) UpdateLedgerAccount(ctx context.Context, req *gen.UpdateLedgerAccountRequest) (*gen.LedgerAccount, error) {
	if req.LedgerAccount == nil {
		return nil, &ServerError{Status: statusLedgerAccountRequired}
	}

	var n gen.LedgerAccountResourceName

	if err := n.UnmarshalString(req.LedgerAccount.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidLedgerAccountName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceLedgerAccount, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInLedgerAccountName}
	}

	// Use CustomID (n.LedgerAccount) instead of parsing as UUID
	m, err := s.repo.GetByCustomID(ctx, orgID, n.LedgerAccount)
	if err != nil {
		if errors.Is(err, repository.ErrLedgerAccountNotFound) {
			return nil, &ServerError{Err: err, Status: statusLedgerAccountNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetLedgerAccount}
	}

	before := *m

	updateParams := repository.UpdateLedgerAccountParams{
		Code:               optional.From(req.LedgerAccount.Code),
		AccountType:        optional.From(model.AccountType(req.LedgerAccount.AccountType)),
		DisplayName:        optional.From(req.LedgerAccount.DisplayName),
		DisplayDescription: optional.From(req.LedgerAccount.DisplayDescription),
	}

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateLedgerAccount}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateLedgerAccount}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return LedgerAccountToProto(n.OrganizationResourceName(), m), nil
}

func (s *ledgerAccountServiceServer) DeleteLedgerAccount(ctx context.Context, req *gen.DeleteLedgerAccountRequest) (*emptypb.Empty, error) {
	var n gen.LedgerAccountResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidLedgerAccountName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceLedgerAccount, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidOrganizationInLedgerAccountName}
	}

	// Use CustomID (n.LedgerAccount) to find the account, then delete by actual ID
	m, err := s.repo.GetByCustomID(ctx, orgID, n.LedgerAccount)
	if err != nil {
		if errors.Is(err, repository.ErrLedgerAccountNotFound) {
			return nil, &ServerError{Err: err, Status: statusLedgerAccountNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetLedgerAccount}
	}

	if err := s.repo.Delete(ctx, m.ID); err != nil {
		if errors.Is(err, repository.ErrLedgerAccountNotFound) {
			return nil, &ServerError{Err: err, Status: statusLedgerAccountNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedDeleteLedgerAccount}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionDelete, m, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}
