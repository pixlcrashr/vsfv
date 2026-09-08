package services

import (
	"errors"

	"github.com/pixlcrashr/vsfv/pkg/authz"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Shared statuses used across multiple service files.
var (
	statusInvalidPageToken = status.New(codes.InvalidArgument, "invalid page_token")
	statusInvalidParent    = status.New(codes.InvalidArgument, "invalid parent")
	statusInvalidFilter    = status.New(codes.InvalidArgument, "invalid filter")
	statusInvalidOrderBy   = status.New(codes.InvalidArgument, "invalid order_by")

	// Auth statuses
	statusUnauthenticated  = status.New(codes.Unauthenticated, "authentication required")
	statusPermissionDenied = status.New(codes.PermissionDenied, "permission denied")

	// Audit log write failure (returned after a successful mutation so that
	// audit gaps are never silent).
	statusFailedRecordAudit = status.New(codes.Internal, "change succeeded but failed to record audit log entry")

	// used by account_group, account, budget, import_source, transaction_account, report_template, report services
	statusOrganizationNotFound = status.New(codes.NotFound, "organization not found")

	// used by account_group, account_group_assignment services
	statusAccountGroupNotFound = status.New(codes.NotFound, "account group not found")

	// used by account_group_assignment, budget_account_value, transaction_account_assignment services
	statusAccountNotFound  = status.New(codes.NotFound, "account not found")
	statusInvalidAccountID = status.New(codes.InvalidArgument, "invalid account_id")

	// used by import_source_period, transaction_account services
	statusImportSourceNotFound = status.New(codes.NotFound, "import source not found")

	// used by transaction, transaction_assignment services
	statusTransactionNotFound                    = status.New(codes.NotFound, "transaction not found")
	statusLedgerAccountNotFound                  = status.New(codes.NotFound, "ledger account not found")
	statusInvalidCreditLedgerAccountID           = status.New(codes.InvalidArgument, "invalid credit_transaction_account_id")
	statusInvalidDebitLedgerAccountID            = status.New(codes.InvalidArgument, "invalid debit_transaction_account_id")
	statusInvalidOrganizationInLedgerAccountName = status.New(codes.InvalidArgument, "invalid organization in ledger account name")
	statusFailedBatchGetLedgerAccounts           = status.New(codes.Internal, "failed to batch get ledger accounts")

	// used by account_group_assignment, transaction_assignment services
	statusAssignmentRequired      = status.New(codes.InvalidArgument, "assignment is required")
	statusInvalidAssignmentName   = status.New(codes.InvalidArgument, "invalid assignment name")
	statusAssignmentNotFound      = status.New(codes.NotFound, "assignment not found")
	statusAssignmentAlreadyExists = status.New(codes.AlreadyExists, "assignment with this ID already exists")
	statusFailedGetAssignment     = status.New(codes.Internal, "failed to get assignment")
	statusFailedListAssignments   = status.New(codes.Internal, "failed to list assignments")
	statusFailedCreateAssignment  = status.New(codes.Internal, "failed to create assignment")
	statusFailedUpdateAssignment  = status.New(codes.Internal, "failed to update assignment")
	statusFailedDeleteAssignment  = status.New(codes.Internal, "failed to delete assignment")
)

// ServerError wraps an internal error and a safe gRPC status.
// The internal Err is never forwarded to the client; only Status is.
type ServerError struct {
	Err    error
	Status *status.Status
}

// Error implements the standard error interface.
func (e *ServerError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}

	return e.Status.Message()
}

// Unwrap allows standard Go errors.Is and errors.As to work.
func (e *ServerError) Unwrap() error {
	return e.Err
}

func (e *ServerError) GRPCStatus() *status.Status {
	return e.Status
}

// normalizePageSize clamps the requested page size to [1, 200], defaulting to 100.
func normalizePageSize(requested int32) int {
	n := int(requested)
	if n <= 0 {
		return 100
	}

	if n > 200 {
		return 200
	}

	return n
}

// authError converts an authz.Check error into a ServerError with the
// appropriate gRPC status code.
func authError(err error) *ServerError {
	if errors.Is(err, authz.ErrUnauthenticated) {
		return &ServerError{Err: err, Status: statusUnauthenticated}
	}
	return &ServerError{Err: err, Status: statusPermissionDenied}
}
