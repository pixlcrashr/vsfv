package services

import (
	"context"
	"errors"
	"strings"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/pixlcrashr/vsfv/pkg/query/order"
	"github.com/theater-improrama/go-utils/optional"
	"go.einride.tech/aip/ordering"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

var (
	statusTransactionAssignmentRequired      = status.New(codes.InvalidArgument, "transaction_assignment is required")
	statusInvalidTransactionAssignmentName   = status.New(codes.InvalidArgument, "invalid transaction assignment name")
	statusInvalidParentTransaction           = status.New(codes.InvalidArgument, "invalid parent transaction")
	statusTransactionAssignmentNotFound      = status.New(codes.NotFound, "transaction assignment not found")
	statusTransactionAssignmentAlreadyExists = status.New(codes.AlreadyExists, "transaction assignment with this ID already exists")
	statusFailedGetTransactionAssignment     = status.New(codes.Internal, "failed to get transaction assignment")
	statusFailedListTransactionAssignments   = status.New(codes.Internal, "failed to list transaction assignments")
	statusFailedCreateTransactionAssignment  = status.New(codes.Internal, "failed to create transaction assignment")
	statusFailedUpdateTransactionAssignment  = status.New(codes.Internal, "failed to update transaction assignment")
	statusFailedDeleteTransactionAssignment  = status.New(codes.Internal, "failed to delete transaction assignment")
	statusAccountIsContainer                 = status.New(codes.InvalidArgument, "account is a container account and cannot be assigned to")
	statusNegativeAssignmentValue            = status.New(codes.InvalidArgument, "assignment value must not be negative")
)

type transactionAssignmentServiceServer struct {
	gen.UnimplementedTransactionAssignmentServiceServer
	repo             *repository.TransactionAssignmentRepository
	accountRepo      *repository.AccountRepository
	organizationRepo *repository.OrganizationRepository
	transactionRepo  *repository.TransactionRepository
	audits           *auditWriter
	enforcer         *authz.Enforcer
}

func newTransactionAssignmentServiceServer(repo *repository.TransactionAssignmentRepository, accountRepo *repository.AccountRepository, organizationRepo *repository.OrganizationRepository, transactionRepo *repository.TransactionRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.TransactionAssignmentServiceServer {
	return &transactionAssignmentServiceServer{repo: repo, accountRepo: accountRepo, organizationRepo: organizationRepo, transactionRepo: transactionRepo, audits: audits, enforcer: enforcer}
}

func (s *transactionAssignmentServiceServer) GetTransactionAssignment(ctx context.Context, req *gen.GetTransactionAssignmentRequest) (*gen.TransactionAssignment, error) {
	var n gen.TransactionAssignmentResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionAssignmentName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceTransactions, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	assignmentID, err := uuid.Parse(n.Assignment)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionAssignmentName}
	}

	m, err := s.repo.GetByID(ctx, assignmentID)
	if err != nil {
		if errors.Is(err, repository.ErrTransactionAssignmentNotFound) {
			return nil, &ServerError{Err: err, Status: statusTransactionAssignmentNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetTransactionAssignment}
	}

	a, err := s.accountRepo.GetByID(ctx, m.AccountID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetTransactionAssignment}
	}

	return TransactionAssignmentToProto(n.TransactionResourceName(), m, a), nil
}

func (s *transactionAssignmentServiceServer) ListTransactionAssignments(ctx context.Context, req *gen.ListTransactionAssignmentsRequest) (*gen.ListTransactionAssignmentsResponse, error) {
	var pn gen.TransactionResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentTransaction}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceTransactions, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentTransaction}
	}

	// A wildcard transaction segment ("-") means "list assignments for
	// all transactions in the organization". Otherwise, a specific transaction
	// UUID is required.
	isWildcard := pn.ContainsWildcard()

	var transID uuid.UUID
	if !isWildcard {
		transID, err = uuid.Parse(pn.Transaction)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidParentTransaction}
		}
	}

	c, err := svcfilter.ParseTransactionAssignmentFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	// Pre-collect all "account" and "transaction" resource name values from
	// the filter condition tree so we can batch-resolve them in a single query
	// each, instead of fetching one-by-one inside cond.Transform.
	var accountLookups []repository.AccountResourceNameLookup
	var transactionLookups []repository.TransactionResourceNameLookup
	collectResourceNames(c, func(field, value string) {
		switch field {
		case "account":
			var rn gen.AccountResourceName
			if err := rn.UnmarshalString(value); err == nil {
				accountLookups = append(accountLookups, repository.AccountResourceNameLookup{
					OrganizationCustomID: rn.Organization,
					AccountCustomID:      rn.Account,
				})
			}
		case "transaction":
			var rn gen.TransactionResourceName
			if err := rn.UnmarshalString(value); err == nil {
				transactionLookups = append(transactionLookups, repository.TransactionResourceNameLookup{
					OrganizationCustomID: rn.Organization,
					TransactionCustomID:  rn.Transaction,
				})
			}
		}
	})

	// Batch-resolve account resource names -> UUID strings.
	accountUUIDByResourceName := make(map[string]string)
	if len(accountLookups) > 0 {
		accounts, err := s.accountRepo.BatchGetByResourceName(ctx, accountLookups)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListTransactionAssignments}
		}
		for i, l := range accountLookups {
			if accounts[i] != nil {
				rn := gen.AccountResourceName{
					Organization: l.OrganizationCustomID,
					Account:      l.AccountCustomID,
				}
				accountUUIDByResourceName[rn.String()] = accounts[i].ID.String()
			}
		}
	}

	// Batch-resolve transaction resource names -> UUID strings.
	transactionUUIDByResourceName := make(map[string]string)
	if len(transactionLookups) > 0 {
		txns, err := s.transactionRepo.BatchGetByResourceName(ctx, transactionLookups)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListTransactionAssignments}
		}
		for i, l := range transactionLookups {
			if txns[i] != nil {
				rn := gen.TransactionResourceName{
					Organization: l.OrganizationCustomID,
					Transaction:  l.TransactionCustomID,
				}
				transactionUUIDByResourceName[rn.String()] = txns[i].ID.String()
			}
		}
	}

	// Transform the condition tree, replacing resource name values with
	// resolved UUIDs using the pre-built lookup maps.
	c = cond.Transform(c, func(field string, value interface{}) (string, interface{}, bool) {
		switch field {
		case "account":
			accountName, ok := value.(string)
			if !ok {
				return field, value, true
			}
			uid, found := accountUUIDByResourceName[accountName]
			if !found {
				return field, value, false
			}
			return "account", uid, true
		case "transaction":
			txName, ok := value.(string)
			if !ok {
				return field, value, true
			}
			uid, found := transactionUUIDByResourceName[txName]
			if !found {
				return field, value, false
			}
			return "transaction", uid, true
		default:
			return field, value, true
		}
	})

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

	orderExprs, _ := order.Resolve(orderBy, repository.TransactionAssignmentOrderFieldMapper)

	params := repository.ListTransactionAssignmentsParams{
		TransactionID:  transID,
		OrganizationID: orgID,
		Page:           int(offset/int64(pageSize)) + 1,
		PageSize:       pageSize,
		Cond:           c,
		OrderBy:        orderExprs,
	}

	ms, total, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListTransactionAssignments}
	}

	resp := &gen.ListTransactionAssignmentsResponse{TotalSize: total}

	// When listing with a wildcard parent, each assignment belongs to a
	// different transaction. We need to resolve the transaction CustomID for
	// each assignment to build the correct resource name. Bulk-load all
	// relevant transactions to avoid N+1 queries.
	var txCustomIDByUUID map[uuid.UUID]string
	if isWildcard && len(ms) > 0 {
		txIDs := make([]uuid.UUID, 0, len(ms))
		seen := make(map[uuid.UUID]struct{}, len(ms))
		for _, m := range ms {
			if _, ok := seen[m.TransactionID]; !ok {
				seen[m.TransactionID] = struct{}{}
				txIDs = append(txIDs, m.TransactionID)
			}
		}
		txns, err := s.transactionRepo.ListByIDs(ctx, txIDs)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListTransactionAssignments}
		}
		txCustomIDByUUID = make(map[uuid.UUID]string, len(txns))
		for _, t := range txns {
			txCustomIDByUUID[t.ID] = t.CustomID
		}
	}

	for _, m := range ms {
		if isWildcard {
			customID, ok := txCustomIDByUUID[m.TransactionID]
			if !ok {
				continue
			}
			txRN := gen.TransactionResourceName{
				Organization: pn.Organization,
				Transaction:  customID,
			}
			resp.Assignments = append(resp.Assignments, TransactionAssignmentToProto(txRN, m, &model.Account{CustomID: m.AccountID.String()}))
		} else {
			resp.Assignments = append(resp.Assignments, TransactionAssignmentToProto(pn, m, &model.Account{CustomID: m.AccountID.String()})) // TODO: very unimportant: replace with custom ID of account
		}
	}

	nextOffset := offset + int64(len(ms))
	if nextOffset < total {
		resp.NextPageToken = pagetoken.Encode(nextOffset)
	}

	return resp, nil
}

// collectResourceNames walks a cond.Cond tree and calls fn for each FieldCond
// whose value is a string. This is used to pre-collect resource name values
// for batch resolution before cond.Transform.
func collectResourceNames(c cond.Cond, fn func(field, value string)) {
	if c == nil || c.IsEmpty() {
		return
	}
	switch cc := c.(type) {
	case cond.FieldCond:
		if s, ok := cc.Value.(string); ok {
			fn(cc.Field, s)
		}
	case cond.AndCond:
		for _, inner := range cc.Conds {
			collectResourceNames(inner, fn)
		}
	case cond.OrCond:
		for _, inner := range cc.Conds {
			collectResourceNames(inner, fn)
		}
	case cond.NotCond:
		collectResourceNames(cc.Inner, fn)
	}
}

func (s *transactionAssignmentServiceServer) CreateTransactionAssignment(ctx context.Context, req *gen.CreateTransactionAssignmentRequest) (*gen.TransactionAssignment, error) {
	var pn gen.TransactionResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentTransaction}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceTransactions, authz.ActionCreate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	transID, err := uuid.Parse(pn.Transaction)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentTransaction}
	}

	if req.Assignment == nil {
		return nil, &ServerError{Status: statusTransactionAssignmentRequired}
	}

	var accountResourceName gen.AccountResourceName
	if err := accountResourceName.UnmarshalString(req.Assignment.Account); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidAccountID}
	}

	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParentTransaction}
	}

	o, err := s.organizationRepo.GetByID(ctx, orgID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
	}

	a, err := s.accountRepo.GetByCustomID(ctx, o.ID, accountResourceName.Account)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusAccountNotFound}
	}

	m, err := s.repo.Create(ctx, repository.CreateTransactionAssignmentParams{
		OrganizationID: o.ID,
		TransactionID:  transID,
		AccountID:      a.ID,
		Value:          decimalProtoToApd(req.Assignment.Value),
	})
	if err != nil {
		if errors.Is(err, repository.ErrTransactionAssignmentAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusTransactionAssignmentAlreadyExists}
		}

		if errors.Is(err, repository.ErrTransactionNotFound) {
			return nil, &ServerError{Err: err, Status: statusTransactionNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedCreateTransactionAssignment}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		pn.TransactionAssignmentResourceName(m.ID.String()).String(), o.ID, m.ID,
	), AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return TransactionAssignmentToProto(pn, m, a), nil
}

func (s *transactionAssignmentServiceServer) UpdateTransactionAssignment(ctx context.Context, req *gen.UpdateTransactionAssignmentRequest) (*gen.TransactionAssignment, error) {
	if req.Assignment == nil {
		return nil, &ServerError{Status: statusTransactionAssignmentRequired}
	}

	var n gen.TransactionAssignmentResourceName

	if err := n.UnmarshalString(req.Assignment.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionAssignmentName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceTransactions, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	assignmentID, err := uuid.Parse(n.Assignment)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionAssignmentName}
	}

	m, err := s.repo.GetByID(ctx, assignmentID)
	if err != nil {
		if errors.Is(err, repository.ErrTransactionAssignmentNotFound) {
			return nil, &ServerError{Err: err, Status: statusTransactionAssignmentNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetTransactionAssignment}
	}

	before := *m

	updateParams := repository.UpdateTransactionAssignmentParams{}

	// Determine which fields are in the update_mask. If no mask is provided,
	// grpc-gateway auto-generates one from the JSON body. For nested message
	// fields (e.g. the Decimal "value"), the auto-generated mask contains the
	// fully-qualified leaf path (e.g. "value.value") rather than the top-level
	// field name. We therefore treat a path as matching if it equals or is a
	// sub-path of the requested field.
	mask := req.UpdateMask
	maskContains := func(path string) bool {
		if mask == nil || len(mask.Paths) == 0 {
			return true
		}
		for _, p := range mask.Paths {
			if p == path || strings.HasPrefix(p, path+".") {
				return true
			}
		}
		return false
	}

	if maskContains("account") {
		var accountResourceName gen.AccountResourceName
		if err := accountResourceName.UnmarshalString(req.Assignment.Account); err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidAccountID}
		}

		orgID, err := uuid.Parse(n.Organization)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusInvalidParentTransaction}
		}

		o, err := s.organizationRepo.GetByID(ctx, orgID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusOrganizationNotFound}
		}

		a, err := s.accountRepo.GetByCustomID(ctx, o.ID, accountResourceName.Account)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusAccountNotFound}
		}

		if a.IsContainer {
			return nil, &ServerError{Status: statusAccountIsContainer}
		}

		updateParams.AccountID = optional.From(a.ID)
	}

	if maskContains("value") && req.Assignment.Value != nil {
		v := decimalProtoToApd(req.Assignment.Value)
		if v.Sign() < 0 {
			return nil, &ServerError{Status: statusNegativeAssignmentValue}
		}
		updateParams.Value = optional.From(v)
	}

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		if errors.Is(err, repository.ErrTransactionAssignmentAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusTransactionAssignmentAlreadyExists}
		}

		return nil, &ServerError{Err: err, Status: statusFailedUpdateTransactionAssignment}
	}

	// Refresh the model after update.
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateTransactionAssignment}
	}

	a, err := s.accountRepo.GetByID(ctx, m.AccountID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateTransactionAssignment}
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionAssignmentName}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return TransactionAssignmentToProto(n.TransactionResourceName(), m, a), nil
}

func (s *transactionAssignmentServiceServer) DeleteTransactionAssignment(ctx context.Context, req *gen.DeleteTransactionAssignmentRequest) (*emptypb.Empty, error) {
	var n gen.TransactionAssignmentResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionAssignmentName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceTransactions, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	assignmentID, err := uuid.Parse(n.Assignment)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionAssignmentName}
	}

	m, err := s.repo.GetByID(ctx, assignmentID)
	if err != nil {
		if errors.Is(err, repository.ErrTransactionAssignmentNotFound) {
			return nil, &ServerError{Err: err, Status: statusTransactionAssignmentNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetTransactionAssignment}
	}

	if err := s.repo.Delete(ctx, assignmentID); err != nil {
		if errors.Is(err, repository.ErrTransactionAssignmentNotFound) {
			return nil, &ServerError{Err: err, Status: statusTransactionAssignmentNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedDeleteTransactionAssignment}
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionAssignmentName}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionDelete, m, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}

// decimalProtoToApd converts a gen.Decimal to apd.Decimal
func decimalProtoToApd(d *gen.Decimal) apd.Decimal {
	if d == nil {
		return apd.Decimal{}
	}
	var result apd.Decimal
	result.SetString(d.Value)
	return result
}
