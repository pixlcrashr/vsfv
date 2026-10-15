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

var _ = Describe("BudgetRevisionService", func() {
	var ctx context.Context
	var orgName string
	var budget *gen.Budget

	BeforeEach(func() {
		ctx = context.Background()

		org, err := OrgClient.CreateOrganization(ctx, &gen.CreateOrganizationRequest{
			Organization: &gen.Organization{DisplayName: "Test Org for Budget Revisions"},
		})
		Expect(err).NotTo(HaveOccurred())
		orgName = org.Name

		budget, err = BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
			Parent: orgName,
			Budget: &gen.Budget{
				DisplayName: "Test Budget",
				PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
				PeriodEnd:   &date.Date{Year: 2024, Month: 12, Day: 31},
			},
		})
		Expect(err).NotTo(HaveOccurred())
	})

	Describe("CreateBudgetRevision", func() {
		It("creates a revision with server-populated fields and no account values snapshot when budget has none", func() {
			resp, err := BudgetRevisionClient.CreateBudgetRevision(ctx, &gen.CreateBudgetRevisionRequest{
				Parent: budget.Name,
				Revision: &gen.BudgetRevision{
					DisplayName:        "Revision Q1",
					DisplayDescription: "First quarter snapshot",
					Date:               &date.Date{Year: 2024, Month: 3, Day: 31},
				},
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.Name).NotTo(BeEmpty())
			Expect(resp.Uid).NotTo(BeEmpty())
			Expect(resp.DisplayName).To(Equal("Revision Q1"))
			Expect(resp.DisplayDescription).To(Equal("First quarter snapshot"))
			Expect(resp.Date).NotTo(BeNil())
			Expect(resp.Date.Year).To(Equal(int32(2024)))
			Expect(resp.Date.Month).To(Equal(int32(3)))
			Expect(resp.Date.Day).To(Equal(int32(31)))
			Expect(resp.CreateTime).NotTo(BeNil())

			avResp, err := BudgetRevisionAccountValueClient.ListBudgetRevisionAccountValues(ctx, &gen.ListBudgetRevisionAccountValuesRequest{
				Parent:   resp.Name,
				PageSize: 100,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(avResp.TotalSize).To(Equal(int64(0)))
		})

		It("snapshots all current budget account values into the revision", func() {
			account1, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
				Parent:  orgName,
				Account: &gen.Account{DisplayName: "Account A"},
			})
			Expect(err).NotTo(HaveOccurred())

			account2, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
				Parent:  orgName,
				Account: &gen.Account{DisplayName: "Account B"},
			})
			Expect(err).NotTo(HaveOccurred())

			_, err = BudgetAccountValueClient.CreateBudgetAccountValue(ctx, &gen.CreateBudgetAccountValueRequest{
				Parent: budget.Name,
				AccountValue: &gen.BudgetAccountValue{
					Account: account1.Name,
					Value:   &gen.Decimal{Value: "100.00"},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			_, err = BudgetAccountValueClient.CreateBudgetAccountValue(ctx, &gen.CreateBudgetAccountValueRequest{
				Parent: budget.Name,
				AccountValue: &gen.BudgetAccountValue{
					Account: account2.Name,
					Value:   &gen.Decimal{Value: "250.50"},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			rev, err := BudgetRevisionClient.CreateBudgetRevision(ctx, &gen.CreateBudgetRevisionRequest{
				Parent: budget.Name,
				Revision: &gen.BudgetRevision{
					DisplayName: "Snapshot Revision",
					Date:        &date.Date{Year: 2024, Month: 6, Day: 30},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			avResp, err := BudgetRevisionAccountValueClient.ListBudgetRevisionAccountValues(ctx, &gen.ListBudgetRevisionAccountValuesRequest{
				Parent:   rev.Name,
				PageSize: 100,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(avResp.TotalSize).To(Equal(int64(2)))

			accountNames := make([]string, 0, len(avResp.AccountValues))
			for _, av := range avResp.AccountValues {
				accountNames = append(accountNames, av.Account)
			}
			Expect(accountNames).To(ConsistOf(account1.Name, account2.Name))
		})

		It("snapshot is independent: updating a budget account value after does not affect the revision", func() {
			account, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
				Parent:  orgName,
				Account: &gen.Account{DisplayName: "Account C"},
			})
			Expect(err).NotTo(HaveOccurred())

			bav, err := BudgetAccountValueClient.CreateBudgetAccountValue(ctx, &gen.CreateBudgetAccountValueRequest{
				Parent: budget.Name,
				AccountValue: &gen.BudgetAccountValue{
					Account: account.Name,
					Value:   &gen.Decimal{Value: "500.00"},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			rev, err := BudgetRevisionClient.CreateBudgetRevision(ctx, &gen.CreateBudgetRevisionRequest{
				Parent: budget.Name,
				Revision: &gen.BudgetRevision{
					DisplayName: "Before Update",
					Date:        &date.Date{Year: 2024, Month: 9, Day: 30},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			_, err = BudgetAccountValueClient.UpdateBudgetAccountValue(ctx, &gen.UpdateBudgetAccountValueRequest{
				AccountValue: &gen.BudgetAccountValue{
					Name:  bav.Name,
					Value: &gen.Decimal{Value: "999.99"},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			avResp, err := BudgetRevisionAccountValueClient.ListBudgetRevisionAccountValues(ctx, &gen.ListBudgetRevisionAccountValuesRequest{
				Parent:   rev.Name,
				PageSize: 100,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(avResp.TotalSize).To(Equal(int64(1)))
			Expect(avResp.AccountValues[0].Value.Value).To(Equal("500"))
		})

		It("returns NotFound when the parent budget does not exist", func() {
			_, err := BudgetRevisionClient.CreateBudgetRevision(ctx, &gen.CreateBudgetRevisionRequest{
				Parent: "organizations/00000000-0000-0000-0000-000000000000/budgets/00000000-0000-0000-0000-000000000000",
				Revision: &gen.BudgetRevision{
					DisplayName: "Ghost Revision",
				},
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns InvalidArgument when revision body is missing", func() {
			_, err := BudgetRevisionClient.CreateBudgetRevision(ctx, &gen.CreateBudgetRevisionRequest{
				Parent: budget.Name,
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})

		It("returns InvalidArgument for a malformed parent name", func() {
			_, err := BudgetRevisionClient.CreateBudgetRevision(ctx, &gen.CreateBudgetRevisionRequest{
				Parent:   "not-a-valid-name",
				Revision: &gen.BudgetRevision{DisplayName: "Bad Parent"},
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})
})

var _ = Describe("BudgetRevisionService ListBudgetRevisions (org-wide)", func() {
	var ctx context.Context
	var orgName string

	BeforeEach(func() {
		ctx = context.Background()

		org, err := OrgClient.CreateOrganization(ctx, &gen.CreateOrganizationRequest{
			Organization: &gen.Organization{DisplayName: "Test Org for Org-Wide Revision Lists"},
		})
		Expect(err).NotTo(HaveOccurred())
		orgName = org.Name
	})

	createBudgetWithRevision := func(name string) (*gen.Budget, *gen.BudgetRevision) {
		budget, err := BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
			Parent: orgName,
			Budget: &gen.Budget{
				DisplayName: name,
				PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
				PeriodEnd:   &date.Date{Year: 2024, Month: 12, Day: 31},
			},
		})
		Expect(err).NotTo(HaveOccurred())

		revision, err := BudgetRevisionClient.CreateBudgetRevision(ctx, &gen.CreateBudgetRevisionRequest{
			Parent: budget.Name,
			Revision: &gen.BudgetRevision{
				DisplayName: name + " Revision",
				Date:        &date.Date{Year: 2024, Month: 6, Day: 30},
			},
		})
		Expect(err).NotTo(HaveOccurred())
		return budget, revision
	}

	It("lists the revisions of every budget in one request and returns real resource names", func() {
		budgetA, revisionA := createBudgetWithRevision("Budget A")
		budgetB, revisionB := createBudgetWithRevision("Budget B")

		resp, err := BudgetRevisionClient.ListBudgetRevisions(ctx, &gen.ListBudgetRevisionsRequest{
			Parent:  orgName + "/budgets/-",
			OrderBy: "create_time asc",
		})
		Expect(err).NotTo(HaveOccurred())
		Expect(resp.TotalSize).To(Equal(int64(2)))

		revisionNames := make([]string, 0, len(resp.Revisions))
		budgetNames := make([]string, 0, len(resp.Revisions))
		for _, revision := range resp.Revisions {
			revisionNames = append(revisionNames, revision.Name)
			budgetNames = append(budgetNames, revision.Budget)
			// Names carry the real budget segment, never the wildcard.
			Expect(revision.Name).NotTo(ContainSubstring("/budgets/-/"))
		}
		Expect(revisionNames).To(ConsistOf(revisionA.Name, revisionB.Name))
		Expect(budgetNames).To(ConsistOf(budgetA.Name, budgetB.Name))
	})

	It("returns InvalidArgument for a literal * budget segment", func() {
		_, err := BudgetRevisionClient.ListBudgetRevisions(ctx, &gen.ListBudgetRevisionsRequest{
			Parent: orgName + "/budgets/*",
		})
		Expect(err).To(HaveOccurred())
		Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
	})
})

var _ = Describe("BudgetRevisionAccountValueService ListBudgetRevisionAccountValues", func() {
	var ctx context.Context
	var orgName string
	var budgetName string

	createAccountWithValue := func(value string) *gen.Account {
		account, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
			Parent:  orgName,
			Account: &gen.Account{DisplayName: "Account " + value},
		})
		Expect(err).NotTo(HaveOccurred())

		_, err = BudgetAccountValueClient.CreateBudgetAccountValue(ctx, &gen.CreateBudgetAccountValueRequest{
			Parent: budgetName,
			AccountValue: &gen.BudgetAccountValue{
				Account: account.Name,
				Value:   &gen.Decimal{Value: value},
			},
		})
		Expect(err).NotTo(HaveOccurred())
		return account
	}

	BeforeEach(func() {
		ctx = context.Background()

		org, err := OrgClient.CreateOrganization(ctx, &gen.CreateOrganizationRequest{
			Organization: &gen.Organization{DisplayName: "Test Org for Revision Value Lists"},
		})
		Expect(err).NotTo(HaveOccurred())
		orgName = org.Name

		budget, err := BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
			Parent: orgName,
			Budget: &gen.Budget{
				DisplayName: "Test Budget",
				PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
				PeriodEnd:   &date.Date{Year: 2024, Month: 12, Day: 31},
			},
		})
		Expect(err).NotTo(HaveOccurred())
		budgetName = budget.Name
	})

	Describe("multi-revision wildcard parent", func() {
		It("fetches values of multiple revisions in one request and returns real resource names", func() {
			account1, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
				Parent:  orgName,
				Account: &gen.Account{DisplayName: "Account A"},
			})
			Expect(err).NotTo(HaveOccurred())

			bav1, err := BudgetAccountValueClient.CreateBudgetAccountValue(ctx, &gen.CreateBudgetAccountValueRequest{
				Parent: budgetName,
				AccountValue: &gen.BudgetAccountValue{
					Account: account1.Name,
					Value:   &gen.Decimal{Value: "100.00"},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			createAccountWithValue("250.50")

			rev1, err := BudgetRevisionClient.CreateBudgetRevision(ctx, &gen.CreateBudgetRevisionRequest{
				Parent: budgetName,
				Revision: &gen.BudgetRevision{
					DisplayName: "Revision 1",
					Date:        &date.Date{Year: 2024, Month: 3, Day: 31},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			// Change one value so the second revision differs.
			_, err = BudgetAccountValueClient.UpdateBudgetAccountValue(ctx, &gen.UpdateBudgetAccountValueRequest{
				AccountValue: &gen.BudgetAccountValue{
					Name:  bav1.Name,
					Value: &gen.Decimal{Value: "999.99"},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			rev2, err := BudgetRevisionClient.CreateBudgetRevision(ctx, &gen.CreateBudgetRevisionRequest{
				Parent: budgetName,
				Revision: &gen.BudgetRevision{
					DisplayName: "Revision 2",
					Date:        &date.Date{Year: 2024, Month: 6, Day: 30},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			wildcardParent := orgName + "/budgets/-/revisions/-"
			avResp, err := BudgetRevisionAccountValueClient.ListBudgetRevisionAccountValues(ctx, &gen.ListBudgetRevisionAccountValuesRequest{
				Parent: wildcardParent,
				Filter: `revision="` + rev1.Name + `" OR revision="` + rev2.Name + `"`,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(avResp.TotalSize).To(Equal(int64(4)))

			revisionNames := make([]string, 0, len(avResp.AccountValues))
			for _, av := range avResp.AccountValues {
				revisionNames = append(revisionNames, av.Revision)
				// Resource names carry the real budget/revision segments,
				// never the wildcard.
				Expect(av.Name).NotTo(ContainSubstring("/budgets/-/"))
				Expect(av.Name).NotTo(ContainSubstring("/revisions/-/"))
			}
			Expect(revisionNames).To(ConsistOf(rev1.Name, rev2.Name, rev1.Name, rev2.Name))
		})

		It("returns InvalidArgument when the wildcard parent names no revisions", func() {
			_, err := BudgetRevisionAccountValueClient.ListBudgetRevisionAccountValues(ctx, &gen.ListBudgetRevisionAccountValuesRequest{
				Parent: orgName + "/budgets/-/revisions/-",
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})

		It("returns InvalidArgument for a literal * wildcard parent", func() {
			_, err := BudgetRevisionAccountValueClient.ListBudgetRevisionAccountValues(ctx, &gen.ListBudgetRevisionAccountValuesRequest{
				Parent: orgName + "/budgets/*/revisions/*",
				Filter: `revision="` + orgName + `/budgets/x/revisions/y"`,
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})

		It("returns InvalidArgument for mixed wildcard parents", func() {
			_, err := BudgetRevisionAccountValueClient.ListBudgetRevisionAccountValues(ctx, &gen.ListBudgetRevisionAccountValuesRequest{
				Parent: budgetName + "/revisions/-",
				Filter: `revision="` + orgName + `/budgets/x/revisions/y"`,
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})

		It("returns InvalidArgument when the revision filter is combined with a concrete parent", func() {
			createAccountWithValue("100.00")

			rev, err := BudgetRevisionClient.CreateBudgetRevision(ctx, &gen.CreateBudgetRevisionRequest{
				Parent: budgetName,
				Revision: &gen.BudgetRevision{
					DisplayName: "Revision 1",
					Date:        &date.Date{Year: 2024, Month: 3, Day: 31},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			_, err = BudgetRevisionAccountValueClient.ListBudgetRevisionAccountValues(ctx, &gen.ListBudgetRevisionAccountValuesRequest{
				Parent: rev.Name,
				Filter: `revision="` + rev.Name + `"`,
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})

		It("returns InvalidArgument when the filter names a revision of another organization", func() {
			createAccountWithValue("100.00")

			otherOrg, err := OrgClient.CreateOrganization(ctx, &gen.CreateOrganizationRequest{
				Organization: &gen.Organization{DisplayName: "Other Org"},
			})
			Expect(err).NotTo(HaveOccurred())

			otherBudget, err := BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
				Parent: otherOrg.Name,
				Budget: &gen.Budget{
					DisplayName: "Other Budget",
					PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
					PeriodEnd:   &date.Date{Year: 2024, Month: 12, Day: 31},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			otherRev, err := BudgetRevisionClient.CreateBudgetRevision(ctx, &gen.CreateBudgetRevisionRequest{
				Parent: otherBudget.Name,
				Revision: &gen.BudgetRevision{
					DisplayName: "Other Revision",
					Date:        &date.Date{Year: 2024, Month: 3, Day: 31},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			_, err = BudgetRevisionAccountValueClient.ListBudgetRevisionAccountValues(ctx, &gen.ListBudgetRevisionAccountValuesRequest{
				Parent: orgName + "/budgets/-/revisions/-",
				Filter: `revision="` + otherRev.Name + `"`,
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})
})
