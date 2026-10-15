package services

import (
	"context"
	"errors"
	"slices"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/theater-improrama/go-utils/optional"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

var (
	statusCommitteePaymentAccountRequired     = status.New(codes.InvalidArgument, "committee payment account is required")
	statusInvalidCommitteePaymentAccountName  = status.New(codes.InvalidArgument, "invalid committee payment account name")
	statusCommitteePaymentAccountNotFound     = status.New(codes.NotFound, "committee payment account not found")
	statusInvalidPaymentAccountKind           = status.New(codes.InvalidArgument, "payment account kind is required")
	statusFailedGetCommitteePaymentAccount    = status.New(codes.Internal, "failed to get committee payment account")
	statusFailedListCommitteePaymentAccounts  = status.New(codes.Internal, "failed to list committee payment accounts")
	statusFailedCreateCommitteePaymentAccount = status.New(codes.Internal, "failed to create committee payment account")
	statusFailedUpdateCommitteePaymentAccount = status.New(codes.Internal, "failed to update committee payment account")
	statusFailedDeleteCommitteePaymentAccount = status.New(codes.Internal, "failed to delete committee payment account")
)

// committeePaymentAccountServiceServer implements
// gen.CommitteePaymentAccountServiceServer.
type committeePaymentAccountServiceServer struct {
	db       *gorm.DB
	enforcer *authz.Enforcer
}

func newCommitteePaymentAccountServiceServer(db *gorm.DB, enforcer *authz.Enforcer) gen.CommitteePaymentAccountServiceServer {
	return &committeePaymentAccountServiceServer{db: db, enforcer: enforcer}
}

// committeePaymentAccountToProto converts a payment account model into its
// proto representation. orgID is the organization UUID segment of the parent
// resource name.
func committeePaymentAccountToProto(m *model.CommitteePaymentAccount, orgID string) *gen.CommitteePaymentAccount {
	return &gen.CommitteePaymentAccount{
		Name: (&gen.CommitteePaymentAccountResourceName{
			Organization:   orgID,
			Committee:      m.CommitteeID.String(),
			PaymentAccount: m.ID.String(),
		}).String(),
		Uid: m.ID.String(),
		Committee: (&gen.CommitteeResourceName{
			Organization: orgID,
			Committee:    m.CommitteeID.String(),
		}).String(),
		Kind:         gen.PaymentAccountKind(m.Kind),
		DisplayLabel: m.DisplayLabel,
		CreateTime:   timestamppb.New(m.CreatedAt),
	}
}

func (s *committeePaymentAccountServiceServer) GetCommitteePaymentAccount(ctx context.Context, req *gen.GetCommitteePaymentAccountRequest) (*gen.CommitteePaymentAccount, error) {
	var n gen.CommitteePaymentAccountResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteePaymentAccountName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	committeeID, err := uuid.Parse(n.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteePaymentAccountName}
	}
	accountID, err := uuid.Parse(n.PaymentAccount)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteePaymentAccountName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.CommitteePaymentAccount, error) {
		repo := repository.NewFactory(tx, s.enforcer).CommitteePaymentAccount()

		m, err := repo.GetByID(ctx, committeeID, accountID)
		if err != nil {
			if errors.Is(err, repository.ErrCommitteePaymentAccountNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteePaymentAccountNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetCommitteePaymentAccount}
		}

		return committeePaymentAccountToProto(m, n.Organization), nil
	})
}

func (s *committeePaymentAccountServiceServer) ListCommitteePaymentAccounts(ctx context.Context, req *gen.ListCommitteePaymentAccountsRequest) (*gen.ListCommitteePaymentAccountsResponse, error) {
	var pn gen.CommitteeResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionRead, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	committeeID, err := uuid.Parse(pn.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	pageSize := normalizePageSize(req.PageSize)
	offset, err := pagetoken.Decode(req.PageToken)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidPageToken}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.ListCommitteePaymentAccountsResponse, error) {
		repo := repository.NewFactory(tx, s.enforcer).CommitteePaymentAccount()

		ms, total, err := repo.List(ctx, committeeID, int(offset/int64(pageSize))+1, pageSize)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListCommitteePaymentAccounts}
		}

		resp := &gen.ListCommitteePaymentAccountsResponse{TotalSize: total}
		for _, m := range ms {
			resp.PaymentAccounts = append(resp.PaymentAccounts, committeePaymentAccountToProto(m, pn.Organization))
		}

		nextOffset := offset + int64(len(ms))
		if nextOffset < total {
			resp.NextPageToken = pagetoken.Encode(nextOffset)
		}

		return resp, nil
	})
}

func (s *committeePaymentAccountServiceServer) CreateCommitteePaymentAccount(ctx context.Context, req *gen.CreateCommitteePaymentAccountRequest) (*gen.CommitteePaymentAccount, error) {
	if req.PaymentAccount == nil {
		return nil, &ServerError{Status: statusCommitteePaymentAccountRequired}
	}

	var pn gen.CommitteeResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	if req.PaymentAccount.Kind == gen.PaymentAccountKind_PAYMENT_ACCOUNT_KIND_UNSPECIFIED {
		return nil, &ServerError{Status: statusInvalidPaymentAccountKind}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionUpdate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	committeeID, err := uuid.Parse(pn.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.CommitteePaymentAccount, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.CommitteePaymentAccount()
		audits := newAuditWriter(tx)

		if _, err := f.Committee().GetByID(ctx, committeeID); err != nil {
			if errors.Is(err, repository.ErrCommitteeNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteeNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedCreateCommitteePaymentAccount}
		}

		m, err := repo.Create(ctx, repository.CreateCommitteePaymentAccountParams{
			CommitteeID:  committeeID,
			Kind:         model.PaymentAccountKind(req.PaymentAccount.Kind),
			DisplayLabel: req.PaymentAccount.DisplayLabel,
		})
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedCreateCommitteePaymentAccount}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			(&gen.CommitteePaymentAccountResourceName{
				Organization: pn.Organization, Committee: committeeID.String(), PaymentAccount: m.ID.String(),
			}).String(),
			orgIDFromSegment(pn.Organization), m.ID,
		), AuditActionCreate, nil, m); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return committeePaymentAccountToProto(m, pn.Organization), nil
	})
}

func (s *committeePaymentAccountServiceServer) UpdateCommitteePaymentAccount(ctx context.Context, req *gen.UpdateCommitteePaymentAccountRequest) (*gen.CommitteePaymentAccount, error) {
	if req.PaymentAccount == nil {
		return nil, &ServerError{Status: statusCommitteePaymentAccountRequired}
	}

	var n gen.CommitteePaymentAccountResourceName
	if err := n.UnmarshalString(req.PaymentAccount.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteePaymentAccountName}
	}

	if req.PaymentAccount.Kind == gen.PaymentAccountKind_PAYMENT_ACCOUNT_KIND_UNSPECIFIED {
		return nil, &ServerError{Status: statusInvalidPaymentAccountKind}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	committeeID, err := uuid.Parse(n.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteePaymentAccountName}
	}
	accountID, err := uuid.Parse(n.PaymentAccount)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteePaymentAccountName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.CommitteePaymentAccount, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.CommitteePaymentAccount()
		audits := newAuditWriter(tx)

		before, err := repo.GetByID(ctx, committeeID, accountID)
		if err != nil {
			if errors.Is(err, repository.ErrCommitteePaymentAccountNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteePaymentAccountNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetCommitteePaymentAccount}
		}

		mask := req.UpdateMask.GetPaths()
		params := repository.UpdateCommitteePaymentAccountParams{}
		if len(mask) == 0 || slices.Contains(mask, "kind") {
			params.Kind = optional.From(model.PaymentAccountKind(req.PaymentAccount.Kind))
		}
		if len(mask) == 0 || slices.Contains(mask, "display_label") {
			params.DisplayLabel = optional.From(req.PaymentAccount.DisplayLabel)
		}

		if err := repo.Update(ctx, committeeID, accountID, params); err != nil {
			if errors.Is(err, repository.ErrCommitteePaymentAccountNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteePaymentAccountNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedUpdateCommitteePaymentAccount}
		}

		after, err := repo.GetByID(ctx, committeeID, accountID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedGetCommitteePaymentAccount}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			(&gen.CommitteePaymentAccountResourceName{
				Organization: n.Organization, Committee: committeeID.String(), PaymentAccount: accountID.String(),
			}).String(),
			orgIDFromSegment(n.Organization), accountID,
		), AuditActionUpdate, before, after); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return committeePaymentAccountToProto(after, n.Organization), nil
	})
}

func (s *committeePaymentAccountServiceServer) DeleteCommitteePaymentAccount(ctx context.Context, req *gen.DeleteCommitteePaymentAccountRequest) (*emptypb.Empty, error) {
	var n gen.CommitteePaymentAccountResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteePaymentAccountName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	committeeID, err := uuid.Parse(n.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteePaymentAccountName}
	}
	accountID, err := uuid.Parse(n.PaymentAccount)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteePaymentAccountName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*emptypb.Empty, error) {
		repo := repository.NewFactory(tx, s.enforcer).CommitteePaymentAccount()
		audits := newAuditWriter(tx)

		before, err := repo.GetByID(ctx, committeeID, accountID)
		if err != nil {
			if errors.Is(err, repository.ErrCommitteePaymentAccountNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteePaymentAccountNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetCommitteePaymentAccount}
		}

		if err := repo.Delete(ctx, committeeID, accountID); err != nil {
			if errors.Is(err, repository.ErrCommitteePaymentAccountNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteePaymentAccountNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedDeleteCommitteePaymentAccount}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			(&gen.CommitteePaymentAccountResourceName{
				Organization: n.Organization, Committee: committeeID.String(), PaymentAccount: accountID.String(),
			}).String(),
			orgIDFromSegment(n.Organization), accountID,
		), AuditActionDelete, before, nil); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return &emptypb.Empty{}, nil
	})
}
