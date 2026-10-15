package repository_test

import (
	"context"
	"time"

	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var _ = Describe("Budgets", func() {
	var (
		ctx context.Context
		org *model.Organization
	)

	createBudget := func(displayName string) (*model.Budget, error) {
		return BudgetRepo.Create(ctx, repository.CreateBudgetParams{
			OrganizationID: org.ID,
			DisplayName:    displayName,
			PeriodStart:    time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			PeriodEnd:      time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC),
		})
	}

	BeforeEach(func() {
		ctx = context.Background()

		var err error
		org, err = OrganizationRepo.Create(ctx, repository.CreateOrganizationParams{
			DisplayName: "Test Organization",
			StartMonth:  time.January,
		})
		Expect(err).NotTo(HaveOccurred())
	})

	Describe("Create", func() {
		It("assigns ascending orders, appending new budgets after the current last one", func() {
			first, err := createBudget("First")
			Expect(err).NotTo(HaveOccurred())
			second, err := createBudget("Second")
			Expect(err).NotTo(HaveOccurred())
			third, err := createBudget("Third")
			Expect(err).NotTo(HaveOccurred())

			Expect(first.Order).To(Equal(int32(0)))
			Expect(second.Order).To(Equal(int32(1)))
			Expect(third.Order).To(Equal(int32(2)))
		})

		It("appends after the highest order even if gaps exist", func() {
			first, err := createBudget("First")
			Expect(err).NotTo(HaveOccurred())
			second, err := createBudget("Second")
			Expect(err).NotTo(HaveOccurred())

			Expect(BudgetRepo.Reorder(ctx, []uuid.UUID{second.ID, first.ID})).To(Succeed())

			third, err := createBudget("Third")
			Expect(err).NotTo(HaveOccurred())
			Expect(third.Order).To(Equal(int32(2)))
		})
	})

	Describe("List", func() {
		It("returns budgets in their custom order by default", func() {
			first, err := createBudget("First")
			Expect(err).NotTo(HaveOccurred())
			second, err := createBudget("Second")
			Expect(err).NotTo(HaveOccurred())
			third, err := createBudget("Third")
			Expect(err).NotTo(HaveOccurred())

			Expect(BudgetRepo.Reorder(ctx, []uuid.UUID{third.ID, first.ID, second.ID})).To(Succeed())

			ms, total, err := BudgetRepo.List(ctx, repository.ListBudgetsParams{
				OrganizationID: org.ID,
				PageSize:       20,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(total).To(Equal(int64(3)))
			Expect(ms).To(HaveLen(3))
			Expect(ms[0].ID).To(Equal(third.ID))
			Expect(ms[1].ID).To(Equal(first.ID))
			Expect(ms[2].ID).To(Equal(second.ID))
		})
	})

	Describe("Reorder", func() {
		It("assigns sequential orders in the given sequence", func() {
			first, err := createBudget("First")
			Expect(err).NotTo(HaveOccurred())
			second, err := createBudget("Second")
			Expect(err).NotTo(HaveOccurred())
			third, err := createBudget("Third")
			Expect(err).NotTo(HaveOccurred())

			Expect(BudgetRepo.Reorder(ctx, []uuid.UUID{third.ID, second.ID, first.ID})).To(Succeed())

			byID := map[uuid.UUID]int32{
				first.ID:  first.Order,
				second.ID: second.Order,
				third.ID:  third.Order,
			}
			for id := range byID {
				m, err := BudgetRepo.GetByID(ctx, id)
				Expect(err).NotTo(HaveOccurred())
				byID[id] = m.Order
			}
			Expect(byID[first.ID]).To(Equal(int32(2)))
			Expect(byID[second.ID]).To(Equal(int32(1)))
			Expect(byID[third.ID]).To(Equal(int32(0)))
		})

		It("is idempotent for budgets already in position", func() {
			first, err := createBudget("First")
			Expect(err).NotTo(HaveOccurred())
			second, err := createBudget("Second")
			Expect(err).NotTo(HaveOccurred())

			Expect(BudgetRepo.Reorder(ctx, []uuid.UUID{first.ID, second.ID})).To(Succeed())
			Expect(BudgetRepo.Reorder(ctx, []uuid.UUID{first.ID, second.ID})).To(Succeed())

			m, err := BudgetRepo.GetByID(ctx, first.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(m.Order).To(Equal(int32(0)))
		})
	})
})
