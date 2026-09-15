package services

import (
	"testing"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"github.com/stretchr/testify/require"
)

func fullCodeChain(accounts ...*model.Account) map[uuid.UUID]*model.Account {
	byID := make(map[uuid.UUID]*model.Account, len(accounts))
	for _, a := range accounts {
		byID[a.ID] = a
	}
	return byID
}

func TestAccountFullCode(t *testing.T) {
	root := &model.Account{ID: uuid.New(), DisplayCode: "A"}
	child := &model.Account{ID: uuid.New(), DisplayCode: "1", ParentAccountID: uuid.NullUUID{Valid: true, UUID: root.ID}}
	grandChild := &model.Account{ID: uuid.New(), DisplayCode: "2", ParentAccountID: uuid.NullUUID{Valid: true, UUID: child.ID}}
	leaf := &model.Account{ID: uuid.New(), DisplayCode: "3", ParentAccountID: uuid.NullUUID{Valid: true, UUID: grandChild.ID}}

	ancestorByID := fullCodeChain(root, child, grandChild, leaf)

	require.Equal(t, "A", accountFullCode(root, ancestorByID))
	require.Equal(t, "A-1", accountFullCode(child, ancestorByID))
	require.Equal(t, "A-1-2", accountFullCode(grandChild, ancestorByID))
	require.Equal(t, "A-1-2-3", accountFullCode(leaf, ancestorByID))
}

func TestAccountFullCodeMissingAncestorTruncatesChain(t *testing.T) {
	root := &model.Account{ID: uuid.New(), DisplayCode: "A"}
	child := &model.Account{ID: uuid.New(), DisplayCode: "1", ParentAccountID: uuid.NullUUID{Valid: true, UUID: root.ID}}
	leaf := &model.Account{ID: uuid.New(), DisplayCode: "2", ParentAccountID: uuid.NullUUID{Valid: true, UUID: child.ID}}

	// root is not part of the lookup, so the chain stops at the child.
	ancestorByID := fullCodeChain(child, leaf)

	require.Equal(t, "1-2", accountFullCode(leaf, ancestorByID))
	require.Equal(t, "2", accountFullCode(leaf, nil))
}

func TestAccountFullCodeCycleTerminates(t *testing.T) {
	a := &model.Account{ID: uuid.New(), DisplayCode: "A"}
	b := &model.Account{ID: uuid.New(), DisplayCode: "B", ParentAccountID: uuid.NullUUID{Valid: true, UUID: a.ID}}
	a.ParentAccountID = uuid.NullUUID{Valid: true, UUID: b.ID}

	// Only termination matters here: a's parent chain is b, then the cycle
	// guard stops the walk when it reaches a again.
	require.Equal(t, "B-A", accountFullCode(a, fullCodeChain(a, b)))
}

func TestAccountToProtoPopulatesFullCode(t *testing.T) {
	root := &model.Account{ID: uuid.New(), CustomID: "root-custom", DisplayCode: "A"}
	child := &model.Account{
		ID:              uuid.New(),
		CustomID:        "child-custom",
		DisplayCode:     "4",
		ParentAccountID: uuid.NullUUID{Valid: true, UUID: root.ID},
	}

	p := AccountToProto(gen.OrganizationResourceName{Organization: "org"}, child, root, fullCodeChain(root, child))

	require.Equal(t, "A-4", p.DisplayFullCode)
	require.Equal(t, "4", p.DisplayCode)
	require.Equal(t, "organizations/org/accounts/root-custom", p.ParentAccount)
}
