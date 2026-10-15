package grpc_test

import (
	"context"
	"time"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"google.golang.org/genproto/googleapis/type/date"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

var _ = Describe("BudgetActualAccountValueService", func() {
	var ctx context.Context
	var orgName string
	var orgUid string
	var budget *gen.Budget
	var account *gen.Account

	BeforeEach(func() {
		ctx = context.Background()

		org, err := OrgClient.CreateOrganization(ctx, &gen.CreateOrganizationRequest{
			Organization: &gen.Organization{DisplayName: "Test Org for Budget Actual Values"},
		})
		Expect(err).NotTo(HaveOccurred())
		orgName = org.Name
		orgUid = org.Uid

		// Create a budget with a defined period
		budget, err = BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
			Parent: orgName,
			Budget: &gen.Budget{
				DisplayName: "Test Budget for Actual Values",
				PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
				PeriodEnd:   &date.Date{Year: 2024, Month: 12, Day: 31},
			},
		})
		Expect(err).NotTo(HaveOccurred())

		// Create an account for testing
		account, err = AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
			Parent:  orgName,
			Account: &gen.Account{DisplayName: "Test Account for Actual Values"},
		})
		Expect(err).NotTo(HaveOccurred())
	})

	Describe("GetBudgetActualAccountValue", func() {
		It("returns NotFound for an account with no transaction assignments", func() {
			var budgetRN gen.BudgetResourceName
			Expect(budgetRN.UnmarshalString(budget.Name)).To(Succeed())
			var accRN gen.AccountResourceName
			Expect(accRN.UnmarshalString(account.Name)).To(Succeed())
			actualValueName := budgetRN.BudgetActualAccountValueResourceName(accRN.Account).String()
			_, err := BudgetActualAccountValueClient.GetBudgetActualAccountValue(ctx, &gen.GetBudgetActualAccountValueRequest{
				Name: actualValueName,
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("computes actual value from transactions within budget period", func() {
			orgUUID, err := uuid.Parse(orgUid)
			Expect(err).NotTo(HaveOccurred())

			var orgRN gen.OrganizationResourceName
			Expect(orgRN.UnmarshalString(orgName)).To(Succeed())

			// Create ledger accounts (no Create RPC, use repo directly)
			creditAccount, err := LedgerAccountRepo.Create(ctx, repository.CreateLedgerAccountParams{
				OrganizationID: orgUUID,
				Code:           "CREDIT-001",
				Type:           nil,
				DisplayName:    "Credit Account",
			})
			Expect(err).NotTo(HaveOccurred())
			creditLedgerAccountName := orgRN.LedgerAccountResourceName(creditAccount.CustomID).String()

			debitAccount, err := LedgerAccountRepo.Create(ctx, repository.CreateLedgerAccountParams{
				OrganizationID: orgUUID,
				Code:           "DEBIT-001",
				Type:           accType(model.LedgerAccountTypeLiquidity),
				DisplayName:    "Debit Account",
			})
			Expect(err).NotTo(HaveOccurred())
			debitLedgerAccountName := orgRN.LedgerAccountResourceName(debitAccount.CustomID).String()

			// Create a transaction within the budget period
			txResp, err := TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
				Transaction: &gen.Transaction{
					CreditLedgerAccount: creditLedgerAccountName,
					DebitLedgerAccount:  debitLedgerAccountName,
					Description:         "Test transaction within period",
					BookedAt:            timestamppb.New(time.Date(2024, 6, 15, 10, 0, 0, 0, time.UTC)),
					DocumentDate:        timestamppb.New(time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC)),
				},
			})
			Expect(err).NotTo(HaveOccurred())

			// Create a transaction assignment linking the transaction to our account
			txUID, err := uuid.Parse(txResp.Uid)
			Expect(err).NotTo(HaveOccurred())
			accountUID, err := uuid.Parse(account.Uid)
			Expect(err).NotTo(HaveOccurred())

			var assignmentValue apd.Decimal
			_, _, err = assignmentValue.SetString("100")
			Expect(err).NotTo(HaveOccurred())

			_, err = TransactionAssignmentRepo.Create(ctx, repository.CreateTransactionAssignmentParams{
				OrganizationID: orgUUID,
				TransactionID:  txUID,
				AccountID:      accountUID,
				Value:          assignmentValue,
			})
			Expect(err).NotTo(HaveOccurred())

			// The actual value should be computed from the transaction assignment
			var budgetRN gen.BudgetResourceName
			Expect(budgetRN.UnmarshalString(budget.Name)).To(Succeed())
			var accRN gen.AccountResourceName
			Expect(accRN.UnmarshalString(account.Name)).To(Succeed())
			actualValueName := budgetRN.BudgetActualAccountValueResourceName(accRN.Account).String()
			resp, err := BudgetActualAccountValueClient.GetBudgetActualAccountValue(ctx, &gen.GetBudgetActualAccountValueRequest{
				Name: actualValueName,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.Name).To(Equal(actualValueName))
			Expect(resp.Account).To(Equal(account.Name))
			Expect(resp.Budget).To(Equal(budget.Name))
			Expect(resp.Value).NotTo(BeNil())
		})

		It("nets an expense and its partial refund booked through distinct accounts", func() {
			orgUUID, err := uuid.Parse(orgUid)
			Expect(err).NotTo(HaveOccurred())

			var orgRN gen.OrganizationResourceName
			Expect(orgRN.UnmarshalString(orgName)).To(Succeed())

			// Three distinct ledger accounts: 1800 (bank), 4000 (expense), 6000 (income)
			bank, err := LedgerAccountRepo.Create(ctx, repository.CreateLedgerAccountParams{
				OrganizationID: orgUUID,
				Code:           "1800",
				Type:           accType(model.LedgerAccountTypeLiquidity),
				DisplayName:    "Bank",
			})
			Expect(err).NotTo(HaveOccurred())
			expense, err := LedgerAccountRepo.Create(ctx, repository.CreateLedgerAccountParams{
				OrganizationID: orgUUID,
				Code:           "4000",
				Type:           nil,
				DisplayName:    "Expense",
			})
			Expect(err).NotTo(HaveOccurred())
			income, err := LedgerAccountRepo.Create(ctx, repository.CreateLedgerAccountParams{
				OrganizationID: orgUUID,
				Code:           "6000",
				Type:           nil,
				DisplayName:    "Income",
			})
			Expect(err).NotTo(HaveOccurred())

			bankName := orgRN.LedgerAccountResourceName(bank.CustomID).String()
			expenseName := orgRN.LedgerAccountResourceName(expense.CustomID).String()
			incomeName := orgRN.LedgerAccountResourceName(income.CustomID).String()

			// Expense: 1800 -> 4000, credit side bank (ASSET) => -100
			tx1, err := TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
				Transaction: &gen.Transaction{
					CreditLedgerAccount: bankName,
					DebitLedgerAccount:  expenseName,
					Description:         "Expense",
					BookedAt:            timestamppb.New(time.Date(2024, 3, 15, 10, 0, 0, 0, time.UTC)),
					DocumentDate:        timestamppb.New(time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC)),
				},
			})
			Expect(err).NotTo(HaveOccurred())

			// Partial refund: 6000 -> 1800, credit side income (REVENUE) => +30
			tx2, err := TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
				Transaction: &gen.Transaction{
					CreditLedgerAccount: incomeName,
					DebitLedgerAccount:  bankName,
					Description:         "Partial refund",
					BookedAt:            timestamppb.New(time.Date(2024, 6, 15, 10, 0, 0, 0, time.UTC)),
					DocumentDate:        timestamppb.New(time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC)),
				},
			})
			Expect(err).NotTo(HaveOccurred())

			accountUID, err := uuid.Parse(account.Uid)
			Expect(err).NotTo(HaveOccurred())

			for _, pair := range []struct {
				txUID string
				value string
			}{
				{tx1.Uid, "100"},
				{tx2.Uid, "30"},
			} {
				txUID, err := uuid.Parse(pair.txUID)
				Expect(err).NotTo(HaveOccurred())

				var v apd.Decimal
				_, _, err = v.SetString(pair.value)
				Expect(err).NotTo(HaveOccurred())

				_, err = TransactionAssignmentRepo.Create(ctx, repository.CreateTransactionAssignmentParams{
					OrganizationID: orgUUID,
					TransactionID:  txUID,
					AccountID:      accountUID,
					Value:          v,
				})
				Expect(err).NotTo(HaveOccurred())
			}

			var budgetRN gen.BudgetResourceName
			Expect(budgetRN.UnmarshalString(budget.Name)).To(Succeed())
			var accRN gen.AccountResourceName
			Expect(accRN.UnmarshalString(account.Name)).To(Succeed())
			actualValueName := budgetRN.BudgetActualAccountValueResourceName(accRN.Account).String()
			resp, err := BudgetActualAccountValueClient.GetBudgetActualAccountValue(ctx, &gen.GetBudgetActualAccountValueRequest{
				Name: actualValueName,
			})
			Expect(err).NotTo(HaveOccurred())
			// -100 (credit bank) + 30 (credit income) = -70
			Expect(resp.Value.GetValue()).To(Equal("-70"))
		})

		It("returns NotFound for a non-existent budget", func() {
			_, err := BudgetActualAccountValueClient.GetBudgetActualAccountValue(ctx, &gen.GetBudgetActualAccountValueRequest{
				Name: "organizations/00000000-0000-0000-0000-000000000000/budgets/00000000-0000-0000-0000-000000000000/actualAccountValues/00000000-0000-0000-0000-000000000000",
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns NotFound for a non-existent account", func() {
			_, err := BudgetActualAccountValueClient.GetBudgetActualAccountValue(ctx, &gen.GetBudgetActualAccountValueRequest{
				Name: budget.Name + "/actualAccountValues/00000000-0000-0000-0000-000000000000",
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns InvalidArgument for a malformed resource name", func() {
			_, err := BudgetActualAccountValueClient.GetBudgetActualAccountValue(ctx, &gen.GetBudgetActualAccountValueRequest{
				Name: "not-a-valid-name",
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})

		It("returns InvalidArgument when name is missing", func() {
			_, err := BudgetActualAccountValueClient.GetBudgetActualAccountValue(ctx, &gen.GetBudgetActualAccountValueRequest{})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})

	Describe("ListBudgetActualAccountValues", func() {
		// Helper: create a transaction + assignment for an account within the budget period
		setupAssignment := func(acc *gen.Account) {
			orgUUID, err := uuid.Parse(orgUid)
			Expect(err).NotTo(HaveOccurred())

			var orgRN gen.OrganizationResourceName
			Expect(orgRN.UnmarshalString(orgName)).To(Succeed())

			creditAccount, err := LedgerAccountRepo.Create(ctx, repository.CreateLedgerAccountParams{
				OrganizationID: orgUUID,
				Code:           "CREDIT-" + acc.Uid[:8],
				Type:           nil,
				DisplayName:    "Credit Account for " + acc.DisplayName,
			})
			Expect(err).NotTo(HaveOccurred())
			creditLedgerAccountName := orgRN.LedgerAccountResourceName(creditAccount.CustomID).String()

			debitAccount, err := LedgerAccountRepo.Create(ctx, repository.CreateLedgerAccountParams{
				OrganizationID: orgUUID,
				Code:           "DEBIT-" + acc.Uid[:8],
				Type:           accType(model.LedgerAccountTypeLiquidity),
				DisplayName:    "Debit Account for " + acc.DisplayName,
			})
			Expect(err).NotTo(HaveOccurred())
			debitLedgerAccountName := orgRN.LedgerAccountResourceName(debitAccount.CustomID).String()

			txResp, err := TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
				Transaction: &gen.Transaction{
					CreditLedgerAccount: creditLedgerAccountName,
					DebitLedgerAccount:  debitLedgerAccountName,
					Description:         "Transaction for " + acc.DisplayName,
					BookedAt:            timestamppb.New(time.Date(2024, 6, 15, 10, 0, 0, 0, time.UTC)),
					DocumentDate:        timestamppb.New(time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC)),
				},
			})
			Expect(err).NotTo(HaveOccurred())

			txUID, err := uuid.Parse(txResp.Uid)
			Expect(err).NotTo(HaveOccurred())
			accountUID, err := uuid.Parse(acc.Uid)
			Expect(err).NotTo(HaveOccurred())

			var val apd.Decimal
			_, _, err = val.SetString("100")
			Expect(err).NotTo(HaveOccurred())

			_, err = TransactionAssignmentRepo.Create(ctx, repository.CreateTransactionAssignmentParams{
				OrganizationID: orgUUID,
				TransactionID:  txUID,
				AccountID:      accountUID,
				Value:          val,
			})
			Expect(err).NotTo(HaveOccurred())
		}

		It("lists actual values for accounts with transaction assignments", func() {
			account2, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
				Parent:  orgName,
				Account: &gen.Account{DisplayName: "Second Account"},
			})
			Expect(err).NotTo(HaveOccurred())

			account3, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
				Parent:  orgName,
				Account: &gen.Account{DisplayName: "Third Account"},
			})
			Expect(err).NotTo(HaveOccurred())

			// Create transaction assignments for all three accounts
			setupAssignment(account)
			setupAssignment(account2)
			setupAssignment(account3)

			resp, err := BudgetActualAccountValueClient.ListBudgetActualAccountValues(ctx, &gen.ListBudgetActualAccountValuesRequest{
				Parent:   budget.Name,
				PageSize: 100,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(len(resp.ActualAccountValues)).To(Equal(3))

			accountNames := make([]string, 0, len(resp.ActualAccountValues))
			for _, av := range resp.ActualAccountValues {
				accountNames = append(accountNames, av.Account)
			}
			Expect(accountNames).To(ContainElements(account.Name, account2.Name, account3.Name))
		})

		It("returns empty list when budget has no transaction assignments", func() {
			emptyBudget, err := BudgetClient.CreateBudget(ctx, &gen.CreateBudgetRequest{
				Parent: orgName,
				Budget: &gen.Budget{
					DisplayName: "Empty Budget",
					PeriodStart: &date.Date{Year: 2024, Month: 1, Day: 1},
					PeriodEnd:   &date.Date{Year: 2024, Month: 12, Day: 31},
				},
			})
			Expect(err).NotTo(HaveOccurred())

			resp, err := BudgetActualAccountValueClient.ListBudgetActualAccountValues(ctx, &gen.ListBudgetActualAccountValuesRequest{
				Parent:   emptyBudget.Name,
				PageSize: 100,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.ActualAccountValues).To(BeEmpty())
			Expect(resp.TotalSize).To(Equal(int64(0)))
		})

		It("respects page_size and returns a next_page_token when more results exist", func() {
			// Create 5 accounts with transaction assignments
			for i := 0; i < 5; i++ {
				acc, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
					Parent:  orgName,
					Account: &gen.Account{DisplayName: "Account " + string(rune('A'+i))},
				})
				Expect(err).NotTo(HaveOccurred())
				setupAssignment(acc)
			}

			resp, err := BudgetActualAccountValueClient.ListBudgetActualAccountValues(ctx, &gen.ListBudgetActualAccountValuesRequest{
				Parent:   budget.Name,
				PageSize: 2,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(len(resp.ActualAccountValues)).To(Equal(2))
			Expect(resp.NextPageToken).NotTo(BeEmpty())
		})

		It("traverses all pages via page tokens", func() {
			// Create 5 accounts with transaction assignments
			for i := 0; i < 5; i++ {
				acc, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
					Parent:  orgName,
					Account: &gen.Account{DisplayName: "Page Account " + string(rune('A'+i))},
				})
				Expect(err).NotTo(HaveOccurred())
				setupAssignment(acc)
			}

			var all []*gen.BudgetActualAccountValue
			var token string
			for {
				resp, err := BudgetActualAccountValueClient.ListBudgetActualAccountValues(ctx, &gen.ListBudgetActualAccountValuesRequest{
					Parent:    budget.Name,
					PageSize:  2,
					PageToken: token,
				})
				Expect(err).NotTo(HaveOccurred())
				all = append(all, resp.ActualAccountValues...)
				if resp.NextPageToken == "" {
					break
				}
				token = resp.NextPageToken
			}
			Expect(len(all)).To(BeNumerically(">=", 5))
		})

		It("filters by account_id", func() {
			account2, err := AccountClient.CreateAccount(ctx, &gen.CreateAccountRequest{
				Parent:  orgName,
				Account: &gen.Account{DisplayName: "Filter Account"},
			})
			Expect(err).NotTo(HaveOccurred())

			// Create assignments for both accounts
			setupAssignment(account)
			setupAssignment(account2)

			// Filter by the second account's resource name
			filter := "account=\"" + account2.Name + "\""
			resp, err := BudgetActualAccountValueClient.ListBudgetActualAccountValues(ctx, &gen.ListBudgetActualAccountValuesRequest{
				Parent: budget.Name,
				Filter: filter,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(len(resp.ActualAccountValues)).To(Equal(1))
			Expect(resp.ActualAccountValues[0].Account).To(Equal(account2.Name))
		})

		It("returns NotFound for a non-existent budget parent", func() {
			_, err := BudgetActualAccountValueClient.ListBudgetActualAccountValues(ctx, &gen.ListBudgetActualAccountValuesRequest{
				Parent: "organizations/00000000-0000-0000-0000-000000000000/budgets/00000000-0000-0000-0000-000000000000",
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns InvalidArgument for a malformed parent resource name", func() {
			_, err := BudgetActualAccountValueClient.ListBudgetActualAccountValues(ctx, &gen.ListBudgetActualAccountValuesRequest{
				Parent: "not-a-valid-name",
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})

		It("returns InvalidArgument when parent is missing", func() {
			_, err := BudgetActualAccountValueClient.ListBudgetActualAccountValues(ctx, &gen.ListBudgetActualAccountValuesRequest{})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})
})
