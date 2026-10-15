package repository_test

import (
	"context"
	"errors"

	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var _ = Describe("CommitteeMembers", func() {
	var ctx context.Context
	var committeeRepo *repository.CommitteeRepository
	var memberRepo *repository.CommitteeMemberRepository
	var userRepo *repository.UserRepository

	// createUser creates a user with a unique e-mail.
	createUser := func(name string) *model.User {
		m, err := userRepo.Create(ctx, repository.CreateUserParams{
			Email: uuid.New().String() + "@example.com",
			Name:  name,
		})
		Expect(err).NotTo(HaveOccurred())
		return m
	}

	// createCommitteeWithMembers creates an organization, a committee and
	// returns both.
	createCommittee := func() (*model.Organization, *model.Committee) {
		org, err := OrganizationRepo.Create(ctx, repository.CreateOrganizationParams{
			DisplayName: "Org",
			CustomID:    uuid.New().String(),
		})
		Expect(err).NotTo(HaveOccurred())
		c, err := committeeRepo.Create(ctx, repository.CreateCommitteeParams{
			OrganizationID: org.ID,
			DisplayName:    "Committee",
			CustomID:       uuid.New().String(),
		})
		Expect(err).NotTo(HaveOccurred())
		return org, c
	}

	// createCommitteeIn creates a committee within the given organization.
	createCommitteeIn := func(orgID uuid.UUID) *model.Committee {
		c, err := committeeRepo.Create(ctx, repository.CreateCommitteeParams{
			OrganizationID: orgID,
			DisplayName:    "Committee",
			CustomID:       uuid.New().String(),
		})
		Expect(err).NotTo(HaveOccurred())
		return c
	}

	BeforeEach(func() {
		ctx = context.Background()
		committeeRepo = repository.NewCommitteeRepository(dbConn)
		memberRepo = repository.NewCommitteeMemberRepository(dbConn)
		userRepo = repository.NewUserRepository(dbConn)
	})

	Describe("Create", func() {
		It("assigns a user to a committee and preloads the user", func() {
			_, c := createCommittee()
			user := createUser("Alice")

			m, err := memberRepo.Create(ctx, c.ID, user.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(m.ID).NotTo(Equal(uuid.Nil))

			got, err := memberRepo.GetByID(ctx, c.ID, m.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(got.User.Name).To(Equal("Alice"))
			Expect(got.User.Email).To(Equal(user.Email))
		})

		It("fails with ErrCommitteeMemberAlreadyExists for duplicate memberships", func() {
			_, c := createCommittee()
			user := createUser("Alice")
			_, err := memberRepo.Create(ctx, c.ID, user.ID)
			Expect(err).NotTo(HaveOccurred())

			_, err = memberRepo.Create(ctx, c.ID, user.ID)
			Expect(errors.Is(err, repository.ErrCommitteeMemberAlreadyExists)).To(BeTrue())
		})
	})

	Describe("List", func() {
		It("returns only the members of the given committee", func() {
			_, first := createCommittee()
			_, second := createCommittee()

			a := createUser("A")
			b := createUser("B")
			_, err := memberRepo.Create(ctx, first.ID, a.ID)
			Expect(err).NotTo(HaveOccurred())
			_, err = memberRepo.Create(ctx, first.ID, b.ID)
			Expect(err).NotTo(HaveOccurred())
			_, err = memberRepo.Create(ctx, second.ID, a.ID)
			Expect(err).NotTo(HaveOccurred())

			members, total, err := memberRepo.List(ctx, first.ID, 1, 100)
			Expect(err).NotTo(HaveOccurred())
			Expect(total).To(Equal(int64(2)))
			Expect(members).To(HaveLen(2))
			Expect([]uuid.UUID{members[0].UserID, members[1].UserID}).To(ContainElements(a.ID, b.ID))
		})
	})

	Describe("Delete", func() {
		It("removes the membership", func() {
			_, c := createCommittee()
			user := createUser("A")
			m, err := memberRepo.Create(ctx, c.ID, user.ID)
			Expect(err).NotTo(HaveOccurred())

			Expect(memberRepo.Delete(ctx, c.ID, m.ID)).To(Succeed())

			_, err = memberRepo.GetByID(ctx, c.ID, m.ID)
			Expect(errors.Is(err, repository.ErrCommitteeMemberNotFound)).To(BeTrue())
		})

		It("returns ErrCommitteeMemberNotFound for unknown IDs", func() {
			_, c := createCommittee()
			err := memberRepo.Delete(ctx, c.ID, uuid.New())
			Expect(errors.Is(err, repository.ErrCommitteeMemberNotFound)).To(BeTrue())
		})
	})

	Describe("Committee delete", func() {
		It("removes the memberships together with the committee", func() {
			_, c := createCommittee()
			user := createUser("A")
			_, err := memberRepo.Create(ctx, c.ID, user.ID)
			Expect(err).NotTo(HaveOccurred())

			Expect(committeeRepo.Delete(ctx, c.ID)).To(Succeed())

			members, total, err := memberRepo.List(ctx, c.ID, 1, 100)
			Expect(err).NotTo(HaveOccurred())
			Expect(total).To(Equal(int64(0)))
			Expect(members).To(BeEmpty())
		})
	})

	Describe("ListCommitteesByUserAndOrganization", func() {
		It("returns only the committees of the organization the user is a member of", func() {
			org, first := createCommittee()
			second := createCommitteeIn(org.ID)
			otherOrg, otherCommittee := createCommittee()

			user := createUser("Alice")
			_, err := memberRepo.Create(ctx, first.ID, user.ID)
			Expect(err).NotTo(HaveOccurred())
			_, err = memberRepo.Create(ctx, second.ID, user.ID)
			Expect(err).NotTo(HaveOccurred())
			_, err = memberRepo.Create(ctx, otherCommittee.ID, user.ID)
			Expect(err).NotTo(HaveOccurred())

			cs, total, err := memberRepo.ListCommitteesByUserAndOrganization(ctx, org.ID, user.ID, 1, 100)
			Expect(err).NotTo(HaveOccurred())
			Expect(total).To(Equal(int64(2)))
			Expect(cs).To(HaveLen(2))
			Expect([]uuid.UUID{cs[0].ID, cs[1].ID}).To(ContainElements(first.ID, second.ID))

			none, total, err := memberRepo.ListCommitteesByUserAndOrganization(ctx, otherOrg.ID, createUser("Bob").ID, 1, 100)
			Expect(err).NotTo(HaveOccurred())
			Expect(total).To(Equal(int64(0)))
			Expect(none).To(BeEmpty())
		})
	})
})
