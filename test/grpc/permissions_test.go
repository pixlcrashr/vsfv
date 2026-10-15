package grpc_test

import (
	"context"

	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/grpc/gen"
)

// The SPA route guards derive their permission map from
// UserServiceCheckUserPermissions. These specs pin down how permissions are
// derived from casbin rules for wildcard groups.
var _ = Describe("CheckUserPermissions", func() {
	// createTestUser inserts a user row directly and returns its ID.
	createTestUser := func(name string) uuid.UUID {
		user := &model.User{Email: uuid.New().String() + "@example.com", Name: name}
		Expect(gormDB.Create(user).Error).NotTo(HaveOccurred())
		return user.ID
	}

	checkPermissions := func(ctx context.Context, userID string, domain string, permissions []string) []string {
		resp, err := UserClient.CheckUserPermissions(ctx, &gen.CheckUserPermissionsRequest{
			Name:        "users/" + userID,
			Domain:      domain,
			Permissions: permissions,
		})
		Expect(err).NotTo(HaveOccurred())
		return resp.Permitted
	}

	It("grants a system group member every requested permission", func() {
		Expect(authz.SeedSystemGroup(context.Background(), gormDB, enforcer)).NotTo(HaveOccurred())
		var systemGroup model.UserGroup
		Expect(gormDB.Where("custom_id = ?", authz.SystemGroupCustomID).First(&systemGroup).Error).NotTo(HaveOccurred())

		userID := createTestUser("System Member")
		added, err := enforcer.AddGlobalGroupingPolicy(userID.String(), systemGroup.ID.String())
		Expect(err).NotTo(HaveOccurred())
		Expect(added).To(BeTrue())
		Expect(enforcer.Flush()).To(Succeed())

		permitted := checkPermissions(
			testCtx,
			userID.String(),
			"organizations/some-org",
			[]string{
				"committees:read", "committees:create", "committees:update", "committees:delete",
				"submissions:read", "submissions:create",
				"dashboard:read",
			},
		)
		Expect(permitted).To(ContainElements(
			"committees:read", "committees:create", "committees:update", "committees:delete",
			"submissions:read", "submissions:create",
			"dashboard:read",
		))
		Expect(permitted).To(HaveLen(7))
	})

	It("grants a system group member global permissions", func() {
		var systemGroup model.UserGroup
		Expect(gormDB.Where("custom_id = ?", authz.SystemGroupCustomID).First(&systemGroup).Error).NotTo(HaveOccurred())

		userID := createTestUser("System Global")
		_, err := enforcer.AddGlobalGroupingPolicy(userID.String(), systemGroup.ID.String())
		Expect(err).NotTo(HaveOccurred())
		Expect(enforcer.Flush()).To(Succeed())

		permitted := checkPermissions(testCtx, userID.String(), "", []string{
			"users:read", "groups:read", "groups:update", "settings:read",
		})
		Expect(permitted).To(ConsistOf("users:read", "groups:read", "groups:update", "settings:read"))
	})

	It("denies a user without membership", func() {
		userID := createTestUser("No Membership")

		permitted := checkPermissions(
			testCtx,
			userID.String(),
			"organizations/some-org",
			[]string{"committees:read"},
		)
		Expect(permitted).To(BeEmpty())
	})

	It("allows users to check their own permissions without users:read", func() {
		// A caller must not need user-management rights to check their own
		// permissions: the SPA route guards run this check for the current
		// user on every navigation.
		userID := createTestUser("Plain User")
		ownCtx := metadata.AppendToOutgoingContext(context.Background(), "x-test-user", userID.String())

		_, err := UserClient.CheckUserPermissions(ownCtx, &gen.CheckUserPermissionsRequest{
			Name:        "users/" + userID.String(),
			Domain:      "organizations/some-org",
			Permissions: []string{"committees:read"},
		})
		Expect(err).NotTo(HaveOccurred())
	})

	It("still requires users:read to check another user's permissions", func() {
		target := createTestUser("Target")
		caller := createTestUser("Plain Caller")
		callerCtx := metadata.AppendToOutgoingContext(context.Background(), "x-test-user", caller.String())

		_, err := UserClient.CheckUserPermissions(callerCtx, &gen.CheckUserPermissionsRequest{
			Name:        "users/" + target.String(),
			Domain:      "organizations/some-org",
			Permissions: []string{"committees:read"},
		})
		Expect(status.Code(err)).To(Equal(codes.PermissionDenied))
	})
})
