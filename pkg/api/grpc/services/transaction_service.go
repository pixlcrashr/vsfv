package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	svcfilter "github.com/pixlcrashr/vsfv/pkg/api/grpc/services/filter"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"github.com/theater-improrama/go-utils/optional"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

var (
	statusTransactionRequired               = status.New(codes.InvalidArgument, "transaction is required")
	statusInvalidTransactionName            = status.New(codes.InvalidArgument, "invalid transaction name")
	statusInvalidCreditTransactionAccountID = status.New(codes.InvalidArgument, "invalid credit_transaction_account_id")
	statusInvalidDebitTransactionAccountID  = status.New(codes.InvalidArgument, "invalid debit_transaction_account_id")
	statusTransactionAlreadyExists          = status.New(codes.AlreadyExists, "transaction with this ID already exists")
	statusFailedGetTransaction              = status.New(codes.Internal, "failed to get transaction")
	statusFailedListTransactions            = status.New(codes.Internal, "failed to list transactions")
	statusFailedCreateTransaction           = status.New(codes.Internal, "failed to create transaction")
	statusFailedUpdateTransaction           = status.New(codes.Internal, "failed to update transaction")
	statusFailedDeleteTransaction           = status.New(codes.Internal, "failed to delete transaction")
)

type transactionServiceServer struct {
	gen.UnimplementedTransactionServiceServer
	repo              *repository.TransactionRepository
	ledgerAccountRepo *repository.LedgerAccountRepository
	audits            *auditWriter
	enforcer          *authz.Enforcer
}

func newTransactionServiceServer(repo *repository.TransactionRepository, ledgerAccountRepo *repository.LedgerAccountRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.TransactionServiceServer {
	return &transactionServiceServer{repo: repo, ledgerAccountRepo: ledgerAccountRepo, audits: audits, enforcer: enforcer}
}

func (s *transactionServiceServer) GetTransaction(ctx context.Context, req *gen.GetTransactionRequest) (*gen.Transaction, error) {
	var n gen.TransactionResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceTransactions, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.Transaction)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionName}
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			return nil, &ServerError{Err: err, Status: statusTransactionNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetTransaction}
	}

	creditLA, err := s.ledgerAccountRepo.GetByID(ctx, m.CreditLedgerAccountID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetTransaction}
	}

	debitLA, err := s.ledgerAccountRepo.GetByID(ctx, m.DebitLedgerAccountID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetTransaction}
	}

	return TransactionToProto(n.OrganizationResourceName(), m, creditLA, debitLA), nil
}

func (s *transactionServiceServer) ListTransactions(ctx context.Context, req *gen.ListTransactionsRequest) (*gen.ListTransactionsResponse, error) {
	var pn gen.OrganizationResourceName

	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceTransactions, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	c, err := svcfilter.ParseTransactionFilter(req.Filter)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidFilter}
	}

	// Resolve "credit_ledger_account" and "debit_ledger_account" resource names in the filter
	// to ledger account UUIDs. The filter fields are resource_references, but the DB columns
	// are "credit_ledger_account_id" and "debit_ledger_account_id" (UUIDs).
	orgID, err := uuid.Parse(pn.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}
	c = cond.Transform(c, func(field string, value interface{}) (string, interface{}, bool) {
		if field != "credit_ledger_account" && field != "debit_ledger_account" {
			return field, value, true
		}
		laName, ok := value.(string)
		if !ok {
			return field, value, true
		}
		var laRN gen.LedgerAccountResourceName
		if err := laRN.UnmarshalString(laName); err != nil {
			return field, value, false
		}
		la, err := s.ledgerAccountRepo.GetByCustomID(ctx, orgID, laRN.LedgerAccount)
		if err != nil {
			return field, value, false
		}
		return field, la.ID.String(), true
	})

	pageSize := normalizePageSize(req.PageSize)

	offset, err := pagetoken.Decode(req.PageToken)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidPageToken}
	}

	params := repository.ListTransactionsParams{
		PageSize: pageSize,
		Offset:   int(offset),
		Cond:     c,
	}

	ms, err := s.repo.List(ctx, params)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedListTransactions}
	}

	resp := &gen.ListTransactionsResponse{}
	for _, m := range ms {
		creditLA, err := s.ledgerAccountRepo.GetByID(ctx, m.CreditLedgerAccountID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListTransactions}
		}

		debitLA, err := s.ledgerAccountRepo.GetByID(ctx, m.DebitLedgerAccountID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListTransactions}
		}

		resp.Transactions = append(resp.Transactions, TransactionToProto(pn, m, creditLA, debitLA))
	}

	if len(ms) == pageSize {
		resp.NextPageToken = pagetoken.Encode(offset + int64(len(ms)))
	}

	return resp, nil
}

func (s *transactionServiceServer) CreateTransaction(ctx context.Context, req *gen.CreateTransactionRequest) (*gen.Transaction, error) {
	if req.Transaction == nil {
		return nil, &ServerError{Status: statusTransactionRequired}
	}

	var n gen.OrganizationResourceName

	if err := n.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceTransactions, authz.ActionCreate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	t := req.Transaction

	var creditResourceName gen.LedgerAccountResourceName
	if err := creditResourceName.UnmarshalString(t.CreditLedgerAccount); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCreditLedgerAccountID}
	}
	creditID, err := uuid.Parse(creditResourceName.LedgerAccount)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCreditLedgerAccountID}
	}

	var debitResourceName gen.LedgerAccountResourceName
	if err := debitResourceName.UnmarshalString(t.DebitLedgerAccount); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidDebitLedgerAccountID}
	}
	debitID, err := uuid.Parse(debitResourceName.LedgerAccount)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidDebitLedgerAccountID}
	}

	params := repository.CreateTransactionParams{
		OrganizationID:        orgID,
		CreditLedgerAccountID: creditID,
		DebitLedgerAccountID:  debitID,
		Description:           t.Description,
		Reference:             t.Reference,
		CustomID:              req.TransactionId,
	}
	if t.BookedAt != nil {
		params.BookedAt = t.BookedAt.AsTime()
	}

	if t.DocumentDate != nil {
		params.DocumentDate = t.DocumentDate.AsTime()
	}

	m, err := s.repo.Create(ctx, params)
	if err != nil {
		if errors.Is(err, repository.ErrTransactionAlreadyExists) {
			return nil, &ServerError{Err: err, Status: statusTransactionAlreadyExists}
		}

		if errors.Is(err, repository.ErrLedgerAccountNotFound) {
			return nil, &ServerError{Err: err, Status: statusLedgerAccountNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedCreateTransaction}
	}

	creditLA, err := s.ledgerAccountRepo.GetByID(ctx, m.CreditLedgerAccountID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedCreateTransaction}
	}

	debitLA, err := s.ledgerAccountRepo.GetByID(ctx, m.DebitLedgerAccountID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedCreateTransaction}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.TransactionResourceName(m.CustomID).String(), orgID, m.ID,
	), AuditActionCreate, nil, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return TransactionToProto(n, m, creditLA, debitLA), nil
}

func (s *transactionServiceServer) UpdateTransaction(ctx context.Context, req *gen.UpdateTransactionRequest) (*gen.Transaction, error) {
	if req.Transaction == nil {
		return nil, &ServerError{Status: statusTransactionRequired}
	}

	var n gen.TransactionResourceName

	if err := n.UnmarshalString(req.Transaction.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceTransactions, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.Transaction)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionName}
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			return nil, &ServerError{Err: err, Status: statusTransactionNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetTransaction}
	}

	before := *m

	t := req.Transaction
	updateParams := repository.UpdateTransactionParams{
		Description: optional.From(t.Description),
		Reference:   optional.From(t.Reference),
	}

	if t.BookedAt != nil {
		updateParams.BookedAt = optional.From(t.BookedAt.AsTime())
	}

	if t.DocumentDate != nil {
		updateParams.DocumentDate = optional.From(t.DocumentDate.AsTime())
	}

	if err := s.repo.Update(ctx, m.ID, updateParams); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateTransaction}
	}

	// Refresh the model after update
	m, err = s.repo.GetByID(ctx, m.ID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateTransaction}
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionName}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionUpdate, &before, m); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	creditLA, err := s.ledgerAccountRepo.GetByID(ctx, m.CreditLedgerAccountID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateTransaction}
	}

	debitLA, err := s.ledgerAccountRepo.GetByID(ctx, m.DebitLedgerAccountID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateTransaction}
	}

	return TransactionToProto(n.OrganizationResourceName(), m, creditLA, debitLA), nil
}

func (s *transactionServiceServer) DeleteTransaction(ctx context.Context, req *gen.DeleteTransactionRequest) (*emptypb.Empty, error) {
	var n gen.TransactionResourceName

	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceTransactions, authz.ActionDelete, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	id, err := uuid.Parse(n.Transaction)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionName}
	}

	m, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			return nil, &ServerError{Err: err, Status: statusTransactionNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedGetTransaction}
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrTransactionNotFound) {
			return nil, &ServerError{Err: err, Status: statusTransactionNotFound}
		}

		return nil, &ServerError{Err: err, Status: statusFailedDeleteTransaction}
	}

	orgID, err := uuid.Parse(n.Organization)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidTransactionName}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		n.String(), orgID, m.ID,
	), AuditActionDelete, m, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}
