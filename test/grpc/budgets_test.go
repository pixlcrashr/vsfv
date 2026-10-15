package grpc_test

import (
	"context"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"google.golang.org/genproto/googleapis/type/date"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
)

var _ = Describe("BudgetService", func() {
	var ctx context.Context
	var orgName string

	BeforeEach(func() {
		ctx = context.Background()
		org, err := OrgClient.CreateOrganization(ctx, &gen.CreateOrganizationRequest{
			Organization: &gen.Organization{DisplayName: "Test Org for Budgets"},
		})
		Expect(err).NotTo(HaveOccurred())
		orgName = org.Name
	})

	Describe("CreateBudget", func() {
		It("creates a budget and returns it with server-populated fields", func() {
			resp, err := BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
				Parent: orgName,
				Budget: &gen.Budget{
					DisplayName:        "Test Budget 2024",
					DisplayDescription: "Annual budget for testing",
					PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
					PeriodEnd:   &date.Date{Year: 2024, Month: 12, Day: 31},
				},
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.Name).NotTo(BeEmpty())
			Expect(resp.Uid).NotTo(BeEmpty())
			Expect(resp.DisplayName).To(Equal("Test Budget 2024"))
			Expect(resp.DisplayDescription).To(Equal("Annual budget for testing"))
			Expect(resp.IsClosed).To(BeFalse())
			Expect(resp.CreateTime).NotTo(BeNil())
			Expect(resp.UpdateTime).NotTo(BeNil())
		})

		It("creates a budget without optional period dates", func() {
			resp, err := BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
				Parent: orgName,
				Budget: &gen.Budget{
					DisplayName: "Simple Budget",
				},
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.DisplayName).To(Equal("Simple Budget"))
		})

		It("returns InvalidArgument when budget body is missing", func() {
			_, err := BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
				Parent: orgName,
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})

	Describe("GetBudget", func() {
		var created *gen.Budget

		BeforeEach(func() {
			var err error
			created, err = BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
				Parent: orgName,
				Budget: &gen.Budget{
					DisplayName: "Get Budget",
					PeriodStart: &date.Date{Year: 2024, Month: 6, Day: 1},
					PeriodEnd:   &date.Date{Year: 2024, Month: 6, Day: 30},
				},
			})
			Expect(err).NotTo(HaveOccurred())
		})

		It("retrieves the budget by resource name", func() {
			resp, err := BudgetClient.GetBudget(ctx, &gen.GetBudgetRequest{Name: created.Name})
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.Name).To(Equal(created.Name))
			Expect(resp.Uid).To(Equal(created.Uid))
			Expect(resp.DisplayName).To(Equal("Get Budget"))
		})

		It("returns NotFound for an unknown resource name", func() {
			_, err := BudgetClient.GetBudget(ctx, &gen.GetBudgetRequest{
				Name: "organizations/00000000-0000-0000-0000-000000000000/budgets/00000000-0000-0000-0000-000000000000",
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns InvalidArgument for a malformed resource name", func() {
			_, err := BudgetClient.GetBudget(ctx, &gen.GetBudgetRequest{Name: "not-valid"})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})

	Describe("ListBudgets", func() {
		BeforeEach(func() {
			for _, name := range []string{"Budget A", "Budget B", "Budget C"} {
				_, err := BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
					Parent: orgName,
					Budget: &gen.Budget{
						DisplayName: name,
						PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
					},
				})
				Expect(err).NotTo(HaveOccurred())
			}
		})

		It("lists all created budgets", func() {
			resp, err := BudgetClient.ListBudgets(ctx, &gen.ListBudgetsRequest{
				Parent:   orgName,
				PageSize: 100,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.TotalSize).To(BeNumerically(">=", 3))
			Expect(len(resp.Budgets)).To(BeNumerically(">=", 3))
		})

		It("respects page_size and returns a next_page_token when more results exist", func() {
			resp, err := BudgetClient.ListBudgets(ctx, &gen.ListBudgetsRequest{
				Parent:   orgName,
				PageSize: 1,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(len(resp.Budgets)).To(Equal(1))
			if resp.TotalSize > 1 {
				Expect(resp.NextPageToken).NotTo(BeEmpty())
			}
		})

		It("traverses all pages via page tokens", func() {
			var all []*gen.Budget
			var token string
			for {
				resp, err := BudgetClient.ListBudgets(ctx, &gen.ListBudgetsRequest{
					Parent:    orgName,
					PageSize:  2,
					PageToken: token,
				})
				Expect(err).NotTo(HaveOccurred())
				all = append(all, resp.Budgets...)
				if resp.NextPageToken == "" {
					break
				}
				token = resp.NextPageToken
			}
			Expect(len(all)).To(BeNumerically(">=", 3))
		})
	})

	Describe("UpdateBudget", func() {
		var created *gen.Budget

		BeforeEach(func() {
			var err error
			created, err = BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
				Parent: orgName,
				Budget: &gen.Budget{
					DisplayName: "Before Update",
					PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
					PeriodEnd:   &date.Date{Year: 2024, Month: 6, Day: 30},
				},
			})
			Expect(err).NotTo(HaveOccurred())
		})

		It("updates the display name and period", func() {
			updated, err := BudgetClient.UpdateBudget(ctx, &gen.UpdateBudgetRequest{
				Budget: &gen.Budget{
					Name:        created.Name,
					DisplayName: "After Update",
					PeriodStart: &date.Date{Year: 2024, Month: 2, Day: 1},
					PeriodEnd:   &date.Date{Year: 2024, Month: 7, Day: 31},
				},
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(updated.DisplayName).To(Equal("After Update"))
			Expect(updated.Name).To(Equal(created.Name))
		})

		It("returns NotFound when updating a non-existent budget", func() {
			_, err := BudgetClient.UpdateBudget(ctx, &gen.UpdateBudgetRequest{
				Budget: &gen.Budget{
					Name:        "organizations/00000000-0000-0000-0000-000000000000/budgets/00000000-0000-0000-0000-000000000000",
					DisplayName: "Ghost",
				},
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns InvalidArgument when budget body is missing", func() {
			_, err := BudgetClient.UpdateBudget(ctx, &gen.UpdateBudgetRequest{})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})

	Describe("CloseBudget", func() {
		var created *gen.Budget

		BeforeEach(func() {
			var err error
			created, err = BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
				Parent: orgName,
				Budget: &gen.Budget{
					DisplayName: "To Close",
					PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
				},
			})
			Expect(err).NotTo(HaveOccurred())
		})

		It("closes the budget", func() {
			resp, err := BudgetClient.CloseBudget(ctx, &gen.CloseBudgetRequest{Name: created.Name})
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.IsClosed).To(BeTrue())

			// Verify it's still retrievable
			getResp, err := BudgetClient.GetBudget(ctx, &gen.GetBudgetRequest{Name: created.Name})
			Expect(err).NotTo(HaveOccurred())
			Expect(getResp.IsClosed).To(BeTrue())
		})

		It("returns NotFound when closing a non-existent budget", func() {
			_, err := BudgetClient.CloseBudget(ctx, &gen.CloseBudgetRequest{
				Name: "organizations/00000000-0000-0000-0000-000000000000/budgets/00000000-0000-0000-0000-000000000000",
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns InvalidArgument for a malformed resource name", func() {
			_, err := BudgetClient.CloseBudget(ctx, &gen.CloseBudgetRequest{Name: "bad-name"})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})

	Describe("DeleteBudget", func() {
		var created *gen.Budget

		BeforeEach(func() {
			var err error
			created, err = BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
				Parent: orgName,
				Budget: &gen.Budget{
					DisplayName: "To Delete",
					PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
				},
			})
			Expect(err).NotTo(HaveOccurred())
		})

		It("permanently deletes the budget", func() {
			_, err := BudgetClient.DeleteBudget(ctx, &gen.DeleteBudgetRequest{Name: created.Name})
			Expect(err).NotTo(HaveOccurred())

			_, err = BudgetClient.GetBudget(ctx, &gen.GetBudgetRequest{Name: created.Name})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns NotFound when deleting a non-existent budget", func() {
			_, err := BudgetClient.DeleteBudget(ctx, &gen.DeleteBudgetRequest{
				Name: "organizations/00000000-0000-0000-0000-000000000000/budgets/00000000-0000-0000-0000-000000000000",
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns InvalidArgument for a malformed resource name", func() {
			_, err := BudgetClient.DeleteBudget(ctx, &gen.DeleteBudgetRequest{Name: "bad-name"})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})
})

var _ = Describe("BudgetAccountValueService ListBudgetAccountValues (org-wide)", func() {
	var ctx context.Context
	var orgName string
	var budgetA *gen.Budget
	var budgetB *gen.Budget

	createAccountValue := func(budget *gen.Budget, accountName string, value string) {
		_, err := BudgetAccountValueClient.CreateBudgetAccountValue(ctx, &gen.CreateBudgetAccountValueRequest{
			Parent: budget.Name,
			AccountValue: &gen.BudgetAccountValue{
				Account: accountName,
				Value:   &gen.Decimal{Value: value},
			},
		})
		Expect(err).NotTo(HaveOccurred())
	}

	BeforeEach(func() {
		ctx = context.Background()

		org, err := OrgClient.CreateOrganization(ctx, &gen.CreateOrganizationRequest{
			Organization: &gen.Organization{DisplayName: "Test Org for Org-Wide Account Values"},
		})
		Expect(err).NotTo(HaveOccurred())
		orgName = org.Name

		budgetA, err = BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
			Parent: orgName,
			Budget: &gen.Budget{
				DisplayName: "Budget A",
				PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
				PeriodEnd:   &date.Date{Year: 2024, Month: 12, Day: 31},
			},
		})
		Expect(err).NotTo(HaveOccurred())

		budgetB, err = BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
			Parent: orgName,
			Budget: &gen.Budget{
				DisplayName: "Budget B",
				PeriodStart: &date.Date{Year: 2025, Month: 1, Day: 1},
				PeriodEnd:   &date.Date{Year: 2025, Month: 12, Day: 31},
			},
		})
		Expect(err).NotTo(HaveOccurred())

		account1, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
			Parent:  orgName,
			Account: &gen.Account{DisplayName: "Account 1"},
		})
		Expect(err).NotTo(HaveOccurred())

		account2, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
			Parent:  orgName,
			Account: &gen.Account{DisplayName: "Account 2"},
		})
		Expect(err).NotTo(HaveOccurred())

		createAccountValue(budgetA, account1.Name, "100.00")
		createAccountValue(budgetA, account2.Name, "200.00")
		createAccountValue(budgetB, account1.Name, "300.00")
	})

	It("lists the account values of every budget in one request and returns real resource names", func() {
		resp, err := BudgetAccountValueClient.ListBudgetAccountValues(ctx, &gen.ListBudgetAccountValuesRequest{
			Parent: orgName + "/budgets/-",
		})
		Expect(err).NotTo(HaveOccurred())
		Expect(resp.TotalSize).To(Equal(int64(3)))

		valueNames := make([]string, 0, len(resp.AccountValues))
		for _, av := range resp.AccountValues {
			valueNames = append(valueNames, av.Name)
			Expect(av.Name).NotTo(ContainSubstring("/budgets/-/"))
			Expect(av.Budget).To(SatisfyAny(Equal(budgetA.Name), Equal(budgetB.Name)))
		}
		Expect(valueNames).To(HaveLen(3))
	})

	It("restricts a wildcard request to the budgets named in the budget filter", func() {
		resp, err := BudgetAccountValueClient.ListBudgetAccountValues(ctx, &gen.ListBudgetAccountValuesRequest{
			Parent: orgName + "/budgets/-",
			Filter: `budget="` + budgetB.Name + `"`,
		})
		Expect(err).NotTo(HaveOccurred())
		Expect(resp.TotalSize).To(Equal(int64(1)))
		Expect(resp.AccountValues).To(HaveLen(1))
		Expect(resp.AccountValues[0].Budget).To(Equal(budgetB.Name))
	})

	It("keeps listing a single budget with a concrete parent", func() {
		resp, err := BudgetAccountValueClient.ListBudgetAccountValues(ctx, &gen.ListBudgetAccountValuesRequest{
			Parent: budgetA.Name,
		})
		Expect(err).NotTo(HaveOccurred())
		Expect(resp.TotalSize).To(Equal(int64(2)))
	})

	It("returns InvalidArgument for a literal * budget segment", func() {
		_, err := BudgetAccountValueClient.ListBudgetAccountValues(ctx, &gen.ListBudgetAccountValuesRequest{
			Parent: orgName + "/budgets/*",
		})
		Expect(err).To(HaveOccurred())
		Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
	})

	It("returns InvalidArgument when the budget filter is combined with a concrete parent", func() {
		_, err := BudgetAccountValueClient.ListBudgetAccountValues(ctx, &gen.ListBudgetAccountValuesRequest{
			Parent: budgetA.Name,
			Filter: `budget="` + budgetB.Name + `"`,
		})
		Expect(err).To(HaveOccurred())
		Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
	})
})
