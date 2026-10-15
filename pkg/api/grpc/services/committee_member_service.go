package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/api/grpc/services/pagetoken"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

var (
	statusCommitteeMemberRequired      = status.New(codes.InvalidArgument, "committee member is required")
	statusInvalidCommitteeMemberName   = status.New(codes.InvalidArgument, "invalid committee member name")
	statusCommitteeMemberNotFound      = status.New(codes.NotFound, "committee member not found")
	statusCommitteeMemberAlreadyExists = status.New(codes.AlreadyExists, "user is already a member of this committee")
	statusFailedGetCommitteeMember     = status.New(codes.Internal, "failed to get committee member")
	statusFailedListCommitteeMembers   = status.New(codes.Internal, "failed to list committee members")
	statusFailedCreateCommitteeMember  = status.New(codes.Internal, "failed to create committee member")
	statusFailedDeleteCommitteeMember  = status.New(codes.Internal, "failed to delete committee member")
)

// committeeMemberServiceServer implements gen.CommitteeMemberServiceServer.
type committeeMemberServiceServer struct {
	db       *gorm.DB
	enforcer *authz.Enforcer
}

func newCommitteeMemberServiceServer(db *gorm.DB, enforcer *authz.Enforcer) gen.CommitteeMemberServiceServer {
	return &committeeMemberServiceServer{db: db, enforcer: enforcer}
}

// CommitteeMemberToProto converts a membership model (with the User
// preloaded) into its proto representation. orgID is the organization UUID
// segment of the parent resource name.
func CommitteeMemberToProto(m *model.CommitteeMember, orgID string) *gen.CommitteeMember {
	return &gen.CommitteeMember{
		Name: (&gen.CommitteeMemberResourceName{
			Organization: orgID,
			Committee:    m.CommitteeID.String(),
			Member:       m.ID.String(),
		}).String(),
		Uid:             m.ID.String(),
		Committee:       (&gen.CommitteeResourceName{Organization: orgID, Committee: m.CommitteeID.String()}).String(),
		User:            (&gen.UserResourceName{User: m.UserID.String()}).String(),
		UserDisplayName: m.User.Name,
		UserEmail:       m.User.Email,
		CreateTime:      timestamppb.New(m.CreatedAt),
	}
}

func (s *committeeMemberServiceServer) GetCommitteeMember(ctx context.Context, req *gen.GetCommitteeMemberRequest) (*gen.CommitteeMember, error) {
	var n gen.CommitteeMemberResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeMemberName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionRead, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	committeeID, err := uuid.Parse(n.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeMemberName}
	}
	memberID, err := uuid.Parse(n.Member)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeMemberName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.CommitteeMember, error) {
		repo := repository.NewFactory(tx, s.enforcer).CommitteeMember()

		m, err := repo.GetByID(ctx, committeeID, memberID)
		if err != nil {
			if errors.Is(err, repository.ErrCommitteeMemberNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteeMemberNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetCommitteeMember}
		}

		return CommitteeMemberToProto(m, n.Organization), nil
	})
}

func (s *committeeMemberServiceServer) ListCommitteeMembers(ctx context.Context, req *gen.ListCommitteeMembersRequest) (*gen.ListCommitteeMembersResponse, error) {
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

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.ListCommitteeMembersResponse, error) {
		repo := repository.NewFactory(tx, s.enforcer).CommitteeMember()

		ms, total, err := repo.List(ctx, committeeID, int(offset/int64(pageSize))+1, pageSize)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedListCommitteeMembers}
		}

		resp := &gen.ListCommitteeMembersResponse{TotalSize: total}
		for _, m := range ms {
			resp.Members = append(resp.Members, CommitteeMemberToProto(m, pn.Organization))
		}

		nextOffset := offset + int64(len(ms))
		if nextOffset < total {
			resp.NextPageToken = pagetoken.Encode(nextOffset)
		}

		return resp, nil
	})
}

func (s *committeeMemberServiceServer) CreateCommitteeMember(ctx context.Context, req *gen.CreateCommitteeMemberRequest) (*gen.CommitteeMember, error) {
	if req.Member == nil {
		return nil, &ServerError{Status: statusCommitteeMemberRequired}
	}

	var pn gen.CommitteeResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	var un gen.UserResourceName
	if err := un.UnmarshalString(req.Member.User); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidUserName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionUpdate, authz.OrgDomain(pn.Organization)); err != nil {
		return nil, authError(err)
	}

	committeeID, err := uuid.Parse(pn.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}
	userID, err := uuid.Parse(un.User)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidUserName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*gen.CommitteeMember, error) {
		f := repository.NewFactory(tx, s.enforcer)
		repo := f.CommitteeMember()
		audits := newAuditWriter(tx)

		if _, err := f.User().GetByID(ctx, userID); err != nil {
			if errors.Is(err, repository.ErrUserNotFound) {
				return nil, &ServerError{Err: err, Status: statusUserNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedCreateCommitteeMember}
		}

		if _, err := f.Committee().GetByID(ctx, committeeID); err != nil {
			if errors.Is(err, repository.ErrCommitteeNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteeNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedCreateCommitteeMember}
		}

		m, err := repo.Create(ctx, committeeID, userID)
		if err != nil {
			if errors.Is(err, repository.ErrCommitteeMemberAlreadyExists) {
				return nil, &ServerError{Err: err, Status: statusCommitteeMemberAlreadyExists}
			}
			return nil, &ServerError{Err: err, Status: statusFailedCreateCommitteeMember}
		}

		// The proto response carries the denormalized user display fields; the
		// freshly created model has no User loaded, so fetch the user again.
		user, err := f.User().GetByID(ctx, userID)
		if err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedCreateCommitteeMember}
		}
		m.User = *user

		if err := audits.Record(ctx, orgAuditSubject(
			(&gen.CommitteeMemberResourceName{Organization: pn.Organization, Committee: committeeID.String(), Member: m.ID.String()}).String(),
			orgIDFromSegment(pn.Organization), m.ID,
		), AuditActionCreate, nil, m); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return CommitteeMemberToProto(m, pn.Organization), nil
	})
}

func (s *committeeMemberServiceServer) DeleteCommitteeMember(ctx context.Context, req *gen.DeleteCommitteeMemberRequest) (*emptypb.Empty, error) {
	var n gen.CommitteeMemberResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeMemberName}
	}

	if err := authz.CheckOrg(ctx, s.enforcer, authz.ResourceCommittees, authz.ActionUpdate, authz.OrgDomain(n.Organization)); err != nil {
		return nil, authError(err)
	}

	committeeID, err := uuid.Parse(n.Committee)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeMemberName}
	}
	memberID, err := uuid.Parse(n.Member)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidCommitteeMemberName}
	}

	return db.Transact(ctx, s.db, func(tx *gorm.DB) (*emptypb.Empty, error) {
		repo := repository.NewFactory(tx, s.enforcer).CommitteeMember()
		audits := newAuditWriter(tx)

		before, err := repo.GetByID(ctx, committeeID, memberID)
		if err != nil {
			if errors.Is(err, repository.ErrCommitteeMemberNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteeMemberNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedGetCommitteeMember}
		}

		if err := repo.Delete(ctx, committeeID, memberID); err != nil {
			if errors.Is(err, repository.ErrCommitteeMemberNotFound) {
				return nil, &ServerError{Err: err, Status: statusCommitteeMemberNotFound}
			}
			return nil, &ServerError{Err: err, Status: statusFailedDeleteCommitteeMember}
		}

		if err := audits.Record(ctx, orgAuditSubject(
			(&gen.CommitteeMemberResourceName{Organization: n.Organization, Committee: committeeID.String(), Member: memberID.String()}).String(),
			orgIDFromSegment(n.Organization), memberID,
		), AuditActionDelete, before, nil); err != nil {
			return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
		}

		return &emptypb.Empty{}, nil
	})
}
