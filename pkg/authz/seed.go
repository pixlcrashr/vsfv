package authz

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"gorm.io/gorm"
)

const (
	AdminGroupCustomID  = "admin"
	SystemGroupCustomID = "system"
)

// SeedAdminGroup ensures that the admin system group exists and has all
// permissions (wildcard policy: domain=*, resource=*, action=*).
// It creates the group if missing, and re-syncs the wildcard policy on every
// startup to guarantee the admin group always has full access.
func SeedAdminGroup(ctx context.Context, db *gorm.DB, enforcer *Enforcer) error {
	return seedWildcardGroup(ctx, db, enforcer, AdminGroupCustomID)
}

// SeedSystemGroup ensures that the "system" system group exists and has all
// permissions (wildcard policy: domain=*, resource=*, action=*).
// It creates the group if missing, and re-syncs the wildcard policy on every
// invocation to guarantee the system group always has full access.
func SeedSystemGroup(ctx context.Context, db *gorm.DB, enforcer *Enforcer) error {
	return seedWildcardGroup(ctx, db, enforcer, SystemGroupCustomID)
}

// seedWildcardGroup ensures that the system group identified by customID
// exists and holds the wildcard policy (p, group, *, *) plus the wildcard
// organization assignment (g3, group, *), giving it access to every
// organization and every permission.
func seedWildcardGroup(ctx context.Context, db *gorm.DB, enforcer *Enforcer, customID string) error {
	var group model.UserGroup
	err := db.WithContext(ctx).Where("custom_id = ?", customID).First(&group).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("authz: check %s group: %w", customID, err)
		}

		log.Printf("Seeding system group %q", customID)

		group = model.UserGroup{
			CustomID:    customID,
			Name:        customID,
			Description: "System group with all permissions. Cannot be edited or deleted.",
			IsSystem:    true,
		}

		if err := db.WithContext(ctx).Create(&group).Error; err != nil {
			return fmt.Errorf("authz: create %s group: %w", customID, err)
		}
	}

	// Re-sync the wildcard policy on every call to ensure the group always
	// has all permissions, even if the casbin model or policy format changes.
	if _, err := enforcer.RemoveFilteredPolicy(0, group.ID.String()); err != nil {
		return fmt.Errorf("authz: clear %s policies: %w", customID, err)
	}

	if _, err := enforcer.AddPolicy(group.ID.String(), "*", "*"); err != nil {
		return fmt.Errorf("authz: add %s wildcard policy: %w", customID, err)
	}

	// Re-sync the wildcard organization assignment so the group has
	// access to every organization without being explicitly assigned to each one.
	if _, err := enforcer.RemoveAllGroupOrgAssignments(group.ID.String()); err != nil {
		return fmt.Errorf("authz: clear %s org assignments: %w", customID, err)
	}

	if _, err := enforcer.AddGroupOrgAssignment(group.ID.String(), WildcardDomain); err != nil {
		return fmt.Errorf("authz: add %s wildcard org assignment: %w", customID, err)
	}

	if err := enforcer.Flush(); err != nil {
		return fmt.Errorf("authz: flush after %s seed: %w", customID, err)
	}

	return nil
}
