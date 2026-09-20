package services

import (
	"context"
	"errors"
	"slices"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/theater-improrama/go-utils/optional"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

var (
	statusSubmissionItemRequired    = status.New(codes.InvalidArgument, "item is required")
	statusInvalidSubmissionItemName = status.New(codes.InvalidArgument, "invalid item name")
	statusSubmissionItemNotFound    = status.New(codes.NotFound, "submission item not found")
	statusFailedGetSubmissionItems  = status.New(codes.Internal, "failed to get submission items")
	statusFailedCreateItem          = status.New(codes.Internal, "failed to create item")
	statusFailedUpdateItem          = status.New(codes.Internal, "failed to update item")
	statusFailedDeleteItem          = status.New(codes.Internal, "failed to delete item")
	statusInvalidAmount             = status.New(codes.InvalidArgument, "invalid amount")
)

// submissionItemServiceServer implements gen.SubmissionItemServiceServer.
type submissionItemServiceServer struct {
	repo     *repository.SubmissionRepository
	audits   *auditWriter
	enforcer *authz.Enforcer
}

func newSubmissionItemServiceServer(repo *repository.SubmissionRepository, audits *auditWriter, enforcer *authz.Enforcer) gen.SubmissionItemServiceServer {
	return &submissionItemServiceServer{repo: repo, audits: audits, enforcer: enforcer}
}

func submissionItemToProto(n gen.SubmissionItemResourceName, m *model.SubmissionItem) *gen.SubmissionItem {
	p := &gen.SubmissionItem{
		Name:         n.String(),
		Uid:          m.ID.String(),
		PublicId:     m.PublicID,
		Category:     m.Category,
		DocumentForm: gen.DocumentForm(m.DocumentForm),
		Source:       m.Source,
		Description:  m.Description,
		Amount:       &gen.Decimal{Value: m.Amount.String()},
	}
	if m.OriginalReceiveTime != nil {
		p.OriginalReceiveTime = timestamppb.New(*m.OriginalReceiveTime)
	}
	if m.OriginalReceivedByUserID.Valid {
		p.OriginalReceivedBy = "users/" + m.OriginalReceivedByUserID.UUID.String()
	}
	return p
}

// checkItemAccess loads the parent submission and verifies read/write access
// plus editability. fullUpdate bypasses the ownership requirement.
func (s *submissionItemServiceServer) checkItemAccess(
	ctx context.Context,
	orgSegment string,
	m *model.Submission,
	requireEditable bool,
	fullUpdate bool,
) error {
	if requireEditable {
		if err := checkSubmissionWrite(ctx, s.enforcer, orgSegment, m); err != nil {
			return err
		}
		if m.DeletedAt.Valid {
			return &ServerError{Status: statusSubmissionDeleted}
		}
		switch m.Status {
		case model.SubmissionStatusDraft, model.SubmissionStatusPending, model.SubmissionStatusFurtherInfoRequired:
		default:
			return &ServerError{Status: statusSubmissionNotEditable}
		}
		return nil
	}
	return checkSubmissionRead(ctx, s.enforcer, orgSegment, m)
}

func (s *submissionItemServiceServer) GetSubmissionItem(ctx context.Context, req *gen.GetSubmissionItemRequest) (*gen.SubmissionItem, error) {
	var n gen.SubmissionItemResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionItemName}
	}

	itemID, err := uuid.Parse(n.Item)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionItemName}
	}

	item, err := s.repo.GetItemByID(ctx, itemID)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionItemNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionItemNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmissionItems}
	}

	parent, err := s.repo.GetByID(ctx, item.SubmissionID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmissionItems}
	}

	if err := s.checkItemAccess(ctx, n.Organization, parent, false, false); err != nil {
		return nil, err
	}

	return submissionItemToProto(n, item), nil
}

func (s *submissionItemServiceServer) ListSubmissionItems(ctx context.Context, req *gen.ListSubmissionItemsRequest) (*gen.ListSubmissionItemsResponse, error) {
	var pn gen.SubmissionResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	submissionID, err := uuid.Parse(pn.Submission)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	parent, err := s.repo.GetByID(ctx, submissionID)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmissionItems}
	}

	if err := s.checkItemAccess(ctx, pn.Organization, parent, false, false); err != nil {
		return nil, err
	}

	items, err := s.repo.ListItems(ctx, submissionID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmissionItems}
	}

	resp := &gen.ListSubmissionItemsResponse{}
	for _, item := range items {
		resp.Items = append(resp.Items, submissionItemToProto(
			gen.SubmissionItemResourceName{Organization: pn.Organization, Submission: pn.Submission, Item: item.ID.String()}, item,
		))
	}
	return resp, nil
}

func (s *submissionItemServiceServer) CreateSubmissionItem(ctx context.Context, req *gen.CreateSubmissionItemRequest) (*gen.SubmissionItem, error) {
	if req.Item == nil {
		return nil, &ServerError{Status: statusSubmissionItemRequired}
	}

	var pn gen.SubmissionResourceName
	if err := pn.UnmarshalString(req.Parent); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	submissionID, err := uuid.Parse(pn.Submission)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidParent}
	}

	parent, err := s.repo.GetByID(ctx, submissionID)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmissionItems}
	}

	if err := s.checkItemAccess(ctx, pn.Organization, parent, true, false); err != nil {
		return nil, err
	}

	amount, ok := parseDecimalString(req.Item.Amount)
	if !ok {
		return nil, &ServerError{Status: statusInvalidAmount}
	}

	item, err := s.repo.CreateItem(ctx, repository.CreateItemParams{
		SubmissionID: submissionID,
		PublicIDBase: parent.PublicID,
		Category:     req.Item.Category,
		DocumentForm: model.DocumentForm(req.Item.DocumentForm),
		Source:       req.Item.Source,
		Description:  req.Item.Description,
		Amount:       amount,
	})
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedCreateItem}
	}

	if _, err := s.repo.RecomputeTotal(ctx, submissionID); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateSubmission}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(
		(&gen.SubmissionItemResourceName{Organization: pn.Organization, Submission: pn.Submission, Item: item.ID.String()}).String(),
		orgIDFromSegment(pn.Organization), item.ID,
	), AuditActionCreate, nil, item); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return submissionItemToProto(
		gen.SubmissionItemResourceName{Organization: pn.Organization, Submission: pn.Submission, Item: item.ID.String()}, item,
	), nil
}

func (s *submissionItemServiceServer) UpdateSubmissionItem(ctx context.Context, req *gen.UpdateSubmissionItemRequest) (*gen.SubmissionItem, error) {
	if req.Item == nil {
		return nil, &ServerError{Status: statusSubmissionItemRequired}
	}

	var n gen.SubmissionItemResourceName
	if err := n.UnmarshalString(req.Item.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionItemName}
	}

	itemID, err := uuid.Parse(n.Item)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionItemName}
	}

	item, err := s.repo.GetItemByID(ctx, itemID)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionItemNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionItemNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmissionItems}
	}

	parent, err := s.repo.GetByID(ctx, item.SubmissionID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmissionItems}
	}

	if err := s.checkItemAccess(ctx, n.Organization, parent, true, false); err != nil {
		return nil, err
	}

	mask := req.UpdateMask.GetPaths()
	params := repository.UpdateItemParams{}
	if len(mask) == 0 || slices.Contains(mask, "category") {
		params.Category = optional.From(req.Item.Category)
	}
	if len(mask) == 0 || slices.Contains(mask, "document_form") {
		params.DocumentForm = optional.From(model.DocumentForm(req.Item.DocumentForm))
	}
	if len(mask) == 0 || slices.Contains(mask, "source") {
		params.Source = optional.From(req.Item.Source)
	}
	if len(mask) == 0 || slices.Contains(mask, "description") {
		params.Description = optional.From(req.Item.Description)
	}
	if len(mask) == 0 || slices.Contains(mask, "amount") {
		amount, ok := parseDecimalString(req.Item.Amount)
		if !ok {
			return nil, &ServerError{Status: statusInvalidAmount}
		}
		params.Amount = optional.From(amount)
	}

	if err := s.repo.UpdateItem(ctx, itemID, params); err != nil {
		if errors.Is(err, repository.ErrSubmissionItemNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionItemNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedUpdateItem}
	}

	if _, err := s.repo.RecomputeTotal(ctx, item.SubmissionID); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateSubmission}
	}

	after, err := s.repo.GetItemByID(ctx, itemID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmissionItems}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(n.String(), orgIDFromSegment(n.Organization), itemID), AuditActionUpdate, item, after); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return submissionItemToProto(n, after), nil
}

func (s *submissionItemServiceServer) DeleteSubmissionItem(ctx context.Context, req *gen.DeleteSubmissionItemRequest) (*emptypb.Empty, error) {
	var n gen.SubmissionItemResourceName
	if err := n.UnmarshalString(req.Name); err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionItemName}
	}

	itemID, err := uuid.Parse(n.Item)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusInvalidSubmissionItemName}
	}

	item, err := s.repo.GetItemByID(ctx, itemID)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionItemNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionItemNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmissionItems}
	}

	parent, err := s.repo.GetByID(ctx, item.SubmissionID)
	if err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedGetSubmissionItems}
	}

	if err := s.checkItemAccess(ctx, n.Organization, parent, true, false); err != nil {
		return nil, err
	}

	if err := s.repo.DeleteItem(ctx, itemID); err != nil {
		if errors.Is(err, repository.ErrSubmissionItemNotFound) {
			return nil, &ServerError{Err: err, Status: statusSubmissionItemNotFound}
		}
		return nil, &ServerError{Err: err, Status: statusFailedDeleteItem}
	}

	if _, err := s.repo.RecomputeTotal(ctx, item.SubmissionID); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedUpdateSubmission}
	}

	if err := s.audits.Record(ctx, orgAuditSubject(n.String(), orgIDFromSegment(n.Organization), itemID), AuditActionDelete, item, nil); err != nil {
		return nil, &ServerError{Err: err, Status: statusFailedRecordAudit}
	}

	return &emptypb.Empty{}, nil
}

// parseDecimalString parses a Decimal.value string into apd.Decimal.
func parseDecimalString(d *gen.Decimal) (apd.Decimal, bool) {
	if d == nil || d.Value == "" {
		return apd.Decimal{}, false
	}
	var v apd.Decimal
	if _, _, err := v.SetString(d.Value); err != nil {
		return apd.Decimal{}, false
	}
	return v, true
}
