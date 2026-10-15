package authz

import (
	"testing"

	"github.com/casbin/casbin/v2"
	"github.com/casbin/casbin/v2/model"
)

// newMatcherEnforcer builds an in-memory enforcer from the embedded model
// with the same policy rows the wildcard group seed writes:
//
//	p, <group>, *, *
//	g3, <group>, *
//	g2, <user>, <group>
func newMatcherEnforcer(t *testing.T) *casbin.Enforcer {
	t.Helper()

	m, err := model.NewModelFromString(readModelConf(t))
	if err != nil {
		t.Fatalf("parse model: %v", err)
	}

	e, err := casbin.NewEnforcer(m)
	if err != nil {
		t.Fatalf("create enforcer: %v", err)
	}

	if _, err := e.AddPolicy("group-1", "*", "*"); err != nil {
		t.Fatalf("add policy: %v", err)
	}
	if _, err := e.AddNamedGroupingPolicy("g3", "group-1", "*"); err != nil {
		t.Fatalf("add g3: %v", err)
	}
	if _, err := e.AddNamedGroupingPolicy("g2", "user-1", "group-1"); err != nil {
		t.Fatalf("add g2: %v", err)
	}

	return e
}

func readModelConf(t *testing.T) string {
	t.Helper()
	data, err := casbinModelFS.ReadFile("casbin_model.conf")
	if err != nil {
		t.Fatalf("read model: %v", err)
	}
	return string(data)
}

func TestWildcardGroupGrantsOrgScopedPermission(t *testing.T) {
	e := newMatcherEnforcer(t)

	allowed, err := e.Enforce("user-1", "organizations/org-1", "committees", "read")
	if err != nil {
		t.Fatalf("enforce: %v", err)
	}
	if !allowed {
		t.Fatal("wildcard group member should be allowed committees:read in any organization")
	}
}

func TestWildcardGroupGrantsGlobalPermission(t *testing.T) {
	e := newMatcherEnforcer(t)

	allowed, err := e.Enforce("user-1", GlobalDomain, "users", "read")
	if err != nil {
		t.Fatalf("enforce: %v", err)
	}
	if !allowed {
		t.Fatal("wildcard group member should be allowed users:read in the global domain")
	}
}

func TestWildcardGroupGrantsEveryAction(t *testing.T) {
	e := newMatcherEnforcer(t)

	for _, action := range []string{ActionCreate, ActionRead, ActionUpdate, ActionDelete} {
		allowed, err := e.Enforce("user-1", "organizations/org-1", "submissions", action)
		if err != nil {
			t.Fatalf("enforce %s: %v", action, err)
		}
		if !allowed {
			t.Fatalf("wildcard group member should be allowed submissions:%s", action)
		}
	}
}

func TestNonMemberIsDenied(t *testing.T) {
	e := newMatcherEnforcer(t)

	allowed, err := e.Enforce("user-2", "organizations/org-1", "committees", "read")
	if err != nil {
		t.Fatalf("enforce: %v", err)
	}
	if allowed {
		t.Fatal("user without group membership should be denied")
	}
}

func TestPerOrgAssignmentScopesAccess(t *testing.T) {
	m, err := model.NewModelFromString(readModelConf(t))
	if err != nil {
		t.Fatalf("parse model: %v", err)
	}
	e, err := casbin.NewEnforcer(m)
	if err != nil {
		t.Fatalf("create enforcer: %v", err)
	}

	// A group with explicit permissions, assigned to a single organization.
	if _, err := e.AddPolicy("group-2", "committees", "read"); err != nil {
		t.Fatalf("add policy: %v", err)
	}
	if _, err := e.AddNamedGroupingPolicy("g3", "group-2", "organizations/org-1"); err != nil {
		t.Fatalf("add g3: %v", err)
	}
	if _, err := e.AddNamedGroupingPolicy("g2", "user-3", "group-2"); err != nil {
		t.Fatalf("add g2: %v", err)
	}

	allowed, err := e.Enforce("user-3", "organizations/org-1", "committees", "read")
	if err != nil {
		t.Fatalf("enforce: %v", err)
	}
	if !allowed {
		t.Fatal("member should be allowed in the assigned organization")
	}

	allowed, err = e.Enforce("user-3", "organizations/org-2", "committees", "read")
	if err != nil {
		t.Fatalf("enforce: %v", err)
	}
	if allowed {
		t.Fatal("member should be denied in an unassigned organization")
	}
}
