package authz

import (
	"fmt"
	"strings"
)

// OrgDomainsWithPermission computes the organization custom-ID domains in
// which the user holds the given permission. It mirrors the casbin matcher
// (g2 user→group, p group policies, g3 group→domain) and is meant for list
// endpoints that must restrict results to the organizations a user can access
// without holding the permission in the global domain.
//
// everywhere reports whether the user holds the permission for every
// organization (wildcard g3 assignment or wildcard policy). orgCustomIDs
// contains the specific organization custom IDs the permission was granted
// for; it is not populated when everywhere is true.
func (en *Enforcer) OrgDomainsWithPermission(userID, resource, action string) (everywhere bool, orgCustomIDs []string, err error) {
	groups, err := en.GetGlobalRolesForUser(userID)
	if err != nil {
		return false, nil, fmt.Errorf("authz: get roles for user: %w", err)
	}

	groupSet := make(map[string]struct{}, len(groups))
	for _, g := range groups {
		groupSet[g] = struct{}{}
	}

	policies, err := en.GetPolicies()
	if err != nil {
		return false, nil, fmt.Errorf("authz: get policies: %w", err)
	}

	// Collect the user's groups whose policies grant resource/action,
	// honoring the matcher's wildcards on obj and act.
	grantingGroups := make(map[string]struct{})
	for _, p := range policies {
		if len(p) < 3 {
			continue
		}
		if _, ok := groupSet[p[0]]; !ok {
			continue
		}
		if p[1] != resource && p[1] != WildcardDomain {
			continue
		}
		if p[2] != action && p[2] != WildcardDomain {
			continue
		}
		grantingGroups[p[0]] = struct{}{}
	}

	if len(grantingGroups) == 0 {
		return false, nil, nil
	}

	assignments, err := en.GetAllGroupOrgAssignments()
	if err != nil {
		return false, nil, fmt.Errorf("authz: get group org assignments: %w", err)
	}

	seen := make(map[string]struct{})
	for g := range grantingGroups {
		for _, dom := range assignments[g] {
			switch {
			case dom == WildcardDomain:
				everywhere = true
			case strings.HasPrefix(dom, OrgDomainPrefix):
				id := strings.TrimPrefix(dom, OrgDomainPrefix)
				if _, dup := seen[id]; dup {
					continue
				}
				seen[id] = struct{}{}
				orgCustomIDs = append(orgCustomIDs, id)
			}
			// The global domain "g" is intentionally ignored: it grants
			// global access, which is checked separately via Enforce.
		}
		if everywhere {
			return true, nil, nil
		}
	}

	return everywhere, orgCustomIDs, nil
}
