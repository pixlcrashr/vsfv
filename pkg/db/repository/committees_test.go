package repository_test

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var _ = Describe("Committees", func() {
	var ctx context.Context
	var committeeRepo *repository.CommitteeRepository

	// createOrg creates an organization to scope committees and submissions.
	createOrg := func() *model.Organization {
		org, err := OrganizationRepo.Create(ctx, repository.CreateOrganizationParams{
			DisplayName: "Org",
			CustomID:    uuid.New().String(),
		})
		Expect(err).NotTo(HaveOccurred())
		return org
	}

	// createCommittee creates a committee with a single payment account.
	createCommittee := func(orgID uuid.UUID) *model.Committee {
		m, err := committeeRepo.Create(ctx, repository.CreateCommitteeParams{
			OrganizationID: orgID,
			DisplayName:    "Committee",
			CustomID:       uuid.New().String(),
		})
		Expect(err).NotTo(HaveOccurred())
		_, err = repository.NewCommitteePaymentAccountRepository(dbConn).Create(ctx, repository.CreateCommitteePaymentAccountParams{
			CommitteeID:  m.ID,
			Kind:         model.PaymentAccountKindBankAccount,
			DisplayLabel: "Konto",
		})
		Expect(err).NotTo(HaveOccurred())
		return m
	}

	// createSubmission creates a submission of the given committee.
	createSubmission := func(orgID, committeeID uuid.UUID) *model.Submission {
		m, err := SubmissionRepo.Create(ctx, repository.CreateSubmissionParams{
			OrganizationID:  orgID,
			CreatedByUserID: uuid.New(),
			CommitteeID:     committeeID,
		})
		Expect(err).NotTo(HaveOccurred())
		return m
	}

	// purgeSubmission marks a submission soft-deleted with a purge time in the
	// past so visibilityWhere(true) excludes it.
	purgeSubmission := func(id uuid.UUID) {
		past := time.Now().UTC().Add(-time.Hour)
		Expect(dbConn.Model(&model.Submission{}).Where("id = ?", id).Updates(map[string]any{
			"deleted_at": past,
			"purge_time": past,
		}).Error).NotTo(HaveOccurred())
	}

	// softDeleteSubmission marks a submission soft-deleted with a purge time in
	// the future so visibilityWhere(true) still includes it.
	softDeleteSubmission := func(id uuid.UUID) {
		now := time.Now().UTC()
		Expect(dbConn.Model(&model.Submission{}).Where("id = ?", id).Updates(map[string]any{
			"deleted_at": now,
			"purge_time": now.Add(24 * time.Hour),
		}).Error).NotTo(HaveOccurred())
	}

	BeforeEach(func() {
		ctx = context.Background()
		committeeRepo = repository.NewCommitteeRepository(dbConn)
	})

	Describe("Delete", func() {
		It("removes the committee and its payment accounts", func() {
			org := createOrg()
			m := createCommittee(org.ID)

			Expect(committeeRepo.Delete(ctx, m.ID)).To(Succeed())

			_, err := committeeRepo.GetByID(ctx, m.ID)
			Expect(errors.Is(err, repository.ErrCommitteeNotFound)).To(BeTrue())

			var count int64
			Expect(dbConn.Model(&model.CommitteePaymentAccount{}).Where("committee_id = ?", m.ID).Count(&count).Error).NotTo(HaveOccurred())
			Expect(count).To(Equal(int64(0)))
		})

		It("returns ErrCommitteeNotFound for unknown IDs", func() {
			err := committeeRepo.Delete(ctx, uuid.New())
			Expect(errors.Is(err, repository.ErrCommitteeNotFound)).To(BeTrue())
		})
	})

	Describe("CountByCommittee", func() {
		It("counts live and soft-deleted submissions but not purged ones", func() {
			org := createOrg()
			m := createCommittee(org.ID)

			live := createSubmission(org.ID, m.ID)
			softDeleted := createSubmission(org.ID, m.ID)
			purged := createSubmission(org.ID, m.ID)
			softDeleteSubmission(softDeleted.ID)
			purgeSubmission(purged.ID)

			count, err := SubmissionRepo.CountByCommittee(ctx, m.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(count).To(Equal(int64(2)))
			Expect(live).NotTo(BeNil())
		})

		It("returns zero for committees without submissions", func() {
			org := createOrg()
			m := createCommittee(org.ID)

			count, err := SubmissionRepo.CountByCommittee(ctx, m.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(count).To(Equal(int64(0)))
		})
	})

	Describe("CountByCommittees", func() {
		It("counts submissions per committee of the organization", func() {
			org := createOrg()
			first := createCommittee(org.ID)
			second := createCommittee(org.ID)

			createSubmission(org.ID, first.ID)
			createSubmission(org.ID, first.ID)
			createSubmission(org.ID, second.ID)

			counts, err := SubmissionRepo.CountByCommittees(ctx, org.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(counts).To(HaveLen(2))
			Expect(counts[first.ID]).To(Equal(int64(2)))
			Expect(counts[second.ID]).To(Equal(int64(1)))
		})

		It("includes soft-deleted and excludes purged submissions", func() {
			org := createOrg()
			m := createCommittee(org.ID)

			softDeleted := createSubmission(org.ID, m.ID)
			purged := createSubmission(org.ID, m.ID)
			softDeleteSubmission(softDeleted.ID)
			purgeSubmission(purged.ID)

			counts, err := SubmissionRepo.CountByCommittees(ctx, org.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(counts[m.ID]).To(Equal(int64(1)))
		})

		It("omits committees without submissions and is scoped to the organization", func() {
			org := createOrg()
			other := createOrg()
			m := createCommittee(org.ID)
			otherCommittee := createCommittee(other.ID)

			createSubmission(other.ID, otherCommittee.ID)

			counts, err := SubmissionRepo.CountByCommittees(ctx, org.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(counts).To(BeEmpty())
			Expect(counts[m.ID]).To(Equal(int64(0)))
		})
	})
})
