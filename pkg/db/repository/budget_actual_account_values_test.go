package repository_test

import (
	"context"
	"time"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/theater-improrama/go-utils/optional"

	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var _ = Describe("BudgetActualAccountValueRepository", func() {
	var ctx context.Context

	var (
		roleLiquidity = model.LedgerAccountTypeLiquidity
		roleCounter   = model.LedgerAccountTypeCounter
		roleStart     = model.LedgerAccountTypeStartAccount
	)

	// Helper to create an organization
	createOrganization := func(name string) *model.Organization {
		org, err := OrganizationRepo.Create(ctx, repository.CreateOrganizationParams{
			DisplayName: name,
			CustomID:    uuid.New().String(),
		})
		Expect(err).NotTo(HaveOccurred())
		return org
	}

	// Helper to create an account
	createAccount := func(orgID uuid.UUID, name string) *model.Account {
		acc, err := AccountRepo.Create(ctx, repository.CreateAccountParams{
			OrganizationID: orgID,
			DisplayName:    name,
			CustomID:       uuid.New().String(),
			IsContainer:    false,
			IsArchived:     false,
		})
		Expect(err).NotTo(HaveOccurred())
		return acc
	}

	// createAccountTree creates a parent account with invertSign and a child
	// with its own invert value, and returns both.
	createAccountTree := func(orgID uuid.UUID, parentInvert, childInvert bool) (parent, child *model.Account) {
		parent, err := AccountRepo.Create(ctx, repository.CreateAccountParams{
			OrganizationID: orgID,
			DisplayName:    "Parent",
			CustomID:       uuid.New().String(),
			IsContainer:    true,
			InvertSign:     parentInvert,
		})
		Expect(err).NotTo(HaveOccurred())

		child, err = AccountRepo.Create(ctx, repository.CreateAccountParams{
			OrganizationID:  orgID,
			ParentAccountID: uuid.NullUUID{UUID: parent.ID, Valid: true},
			DisplayName:     "Child",
			CustomID:        uuid.New().String(),
			InvertSign:      childInvert,
		})
		Expect(err).NotTo(HaveOccurred())
		return parent, child
	}

	// Helper to create a budget
	createBudget := func(orgID uuid.UUID, startDate, endDate time.Time) *model.Budget {
		budget, err := BudgetRepo.Create(ctx, repository.CreateBudgetParams{
			OrganizationID: orgID,
			DisplayName:    "Test Budget",
			PeriodStart:    startDate,
			PeriodEnd:      endDate,
			CustomID:       uuid.New().String(),
		})
		Expect(err).NotTo(HaveOccurred())
		return budget
	}

	// Helper to create ledger account with a specific type; nil leaves
	// the account unmarked (plain income/expense-side account).
	createLedgerAccount := func(orgID uuid.UUID, code string, balanceRole *model.LedgerAccountType) *model.LedgerAccount {
		acc, err := LedgerAccountRepo.Create(ctx, repository.CreateLedgerAccountParams{
			OrganizationID: orgID,
			Code:           code,
			Type:           balanceRole,
			DisplayName:    "Ledger Account " + code,
			CustomID:       uuid.New().String(),
		})
		Expect(err).NotTo(HaveOccurred())
		return acc
	}

	// Helper to create transaction
	createTransaction := func(orgID, creditLedgerAccID, debitLedgerAccID uuid.UUID, docDate time.Time, amount string) *model.Transaction_ {
		tx, err := TransactionRepo.Create(ctx, repository.CreateTransactionParams{
			OrganizationID:        orgID,
			CreditLedgerAccountID: creditLedgerAccID,
			DebitLedgerAccountID:  debitLedgerAccID,
			Description:           "Test transaction",
			DocumentDate:          docDate,
			BookedAt:              docDate,
		})
		Expect(err).NotTo(HaveOccurred())
		return tx
	}

	// Helper to create transaction assignment
	createAssignment := func(orgID, txID, accountID uuid.UUID, value string) {
		val := apd.Decimal{}
		_, _, err := val.SetString(value)
		Expect(err).NotTo(HaveOccurred())

		err = dbConn.WithContext(ctx).Exec(
			"INSERT INTO transaction_assignments (id, organization_id, transaction_id, account_id, value) VALUES (?, ?, ?, ?, ?)",
			uuid.New(), orgID, txID, accountID, val,
		).Error
		Expect(err).NotTo(HaveOccurred())
	}

	Describe("ListByBudget", func() {
		It("returns empty list when budget has no transactions", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)
			createBudget(org.ID, startDate, endDate)
			// Create an account but no transactions
			createAccount(org.ID, "Test Account")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(BeEmpty())
		})

		It("computes actual values from transactions within budget period", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Revenue Account")
			// Money paid out of bank to an unmarked income/expense account:
			// debit unmarked / credit liquidity => negative
			creditTxAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc := createLedgerAccount(org.ID, "REV-001", nil)

			// Create transaction within budget period
			tx := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "1000.00")
			createAssignment(org.ID, tx.ID, account.ID, "1000.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(1))
			Expect(result[0].AccountID).To(Equal(account.ID))
			expectDecimalEqual(result[0].Value, "-1000.00")
		})

		It("excludes transactions outside budget period", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Revenue Account")
			creditTxAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc := createLedgerAccount(org.ID, "REV-001", nil)

			// Create transaction BEFORE budget period
			tx1 := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2023, 6, 15, 0, 0, 0, 0, time.UTC), "500.00")
			createAssignment(org.ID, tx1.ID, account.ID, "500.00")

			// Create transaction AFTER budget period
			tx2 := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2025, 6, 15, 0, 0, 0, 0, time.UTC), "500.00")
			createAssignment(org.ID, tx2.ID, account.ID, "500.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(BeEmpty())
		})

		It("computes net value from multiple assignments", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Revenue Account")
			creditTxAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc := createLedgerAccount(org.ID, "REV-001", nil)

			// Multiple transactions for same account
			tx1 := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC), "1000.00")
			createAssignment(org.ID, tx1.ID, account.ID, "1000.00")

			tx2 := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "2000.00")
			createAssignment(org.ID, tx2.ID, account.ID, "2000.00")

			tx3 := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2024, 9, 15, 0, 0, 0, 0, time.UTC), "500.00")
			createAssignment(org.ID, tx3.ID, account.ID, "500.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(1))
			expectDecimalEqual(result[0].Value, "-3500.00")
		})

		It("computes values for multiple accounts", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account1 := createAccount(org.ID, "Revenue Account")
			account2 := createAccount(org.ID, "Expense Account")
			creditTxAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc := createLedgerAccount(org.ID, "REV-001", nil)

			// Transaction for account 1
			tx1 := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "1000.00")
			createAssignment(org.ID, tx1.ID, account1.ID, "1000.00")

			// Transaction for account 2
			tx2 := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2024, 7, 15, 0, 0, 0, 0, time.UTC), "2000.00")
			createAssignment(org.ID, tx2.ID, account2.ID, "2000.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(2))

			// Find values by account
			var value1, value2 apd.Decimal
			for _, r := range result {
				if r.AccountID == account1.ID {
					value1 = r.Value
				}
				if r.AccountID == account2.ID {
					value2 = r.Value
				}
			}
			expectDecimalEqual(value1, "-1000.00")
			expectDecimalEqual(value2, "-2000.00")
		})

		It("orders results by account_id", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account1 := createAccount(org.ID, "Account A")
			account2 := createAccount(org.ID, "Account B")
			creditTxAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc := createLedgerAccount(org.ID, "REV-001", nil)

			tx1 := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "500.00")
			createAssignment(org.ID, tx1.ID, account1.ID, "500.00")
			tx2 := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2024, 6, 16, 0, 0, 0, 0, time.UTC), "500.00")
			createAssignment(org.ID, tx2.ID, account2.ID, "500.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(2))
			// Should be ordered by account_id
			Expect(result[0].AccountID.String() < result[1].AccountID.String()).To(BeTrue())
		})

		It("computes values correctly with different credit/debit accounts per transaction", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Test Account")
			// Create two different pairs of ledger accounts
			creditTxAcc1 := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc1 := createLedgerAccount(org.ID, "REV-001", nil)
			creditTxAcc2 := createLedgerAccount(org.ID, "BANK-002", &roleLiquidity)
			debitTxAcc2 := createLedgerAccount(org.ID, "EXP-001", nil)

			// Transaction 1: BANK-001 -> REV-001
			tx1 := createTransaction(org.ID, creditTxAcc1.ID, debitTxAcc1.ID, time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC), "1000.00")
			createAssignment(org.ID, tx1.ID, account.ID, "1000.00")

			// Transaction 2: BANK-002 -> EXP-001 (different credit/debit accounts)
			tx2 := createTransaction(org.ID, creditTxAcc2.ID, debitTxAcc2.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "2000.00")
			createAssignment(org.ID, tx2.ID, account.ID, "2000.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(1))
			expectDecimalEqual(result[0].Value, "-3000.00")
		})

		It("computes net value when previous debit account becomes credit account", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Test Account")

			// Create ledger accounts
			creditTxAcc1 := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc1 := createLedgerAccount(org.ID, "REV-001", nil)

			// Transaction 1: BANK-001 -> REV-001 (money leaves: negative)
			tx1 := createTransaction(org.ID, creditTxAcc1.ID, debitTxAcc1.ID, time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC), "1000.00")
			createAssignment(org.ID, tx1.ID, account.ID, "1000.00")

			// Transaction 2: REV-001 -> BANK-001 (money returns: positive)
			tx2 := createTransaction(org.ID, debitTxAcc1.ID, creditTxAcc1.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "300.00")
			createAssignment(org.ID, tx2.ID, account.ID, "300.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(1))
			// Net value should be 1000 - 300 = 700
			expectDecimalEqual(result[0].Value, "-700.00")
		})

		It("computes net value when an expense booked from bank is partially refunded via an income account", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Test Account")

			// Three distinct ledger accounts: 1800 (bank), 4000 (expense), 6000 (income)
			bank := createLedgerAccount(org.ID, "1800", &roleLiquidity)
			expense := createLedgerAccount(org.ID, "4000", nil)
			income := createLedgerAccount(org.ID, "6000", nil)

			// Expense: debit expense / credit bank => -100
			tx1 := createTransaction(org.ID, bank.ID, expense.ID, time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC), "100.00")
			createAssignment(org.ID, tx1.ID, account.ID, "100.00")

			// Partial refund: debit bank / credit income => +30
			tx2 := createTransaction(org.ID, income.ID, bank.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "30.00")
			createAssignment(org.ID, tx2.ID, account.ID, "30.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(1))
			// Net value should be -100 + 30 = -70
			expectDecimalEqual(result[0].Value, "-70.00")
		})

		It("computes values correctly for multiple accounts with reverse flows", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account1 := createAccount(org.ID, "Account A")
			account2 := createAccount(org.ID, "Account B")

			// Create ledger accounts
			creditTxAcc1 := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc1 := createLedgerAccount(org.ID, "REV-001", nil)

			// Transaction 1: Forward flow for account1
			tx1 := createTransaction(org.ID, creditTxAcc1.ID, debitTxAcc1.ID, time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC), "1000.00")
			createAssignment(org.ID, tx1.ID, account1.ID, "1000.00")

			// Transaction 2: Reverse flow for account1 (partial reversal)
			tx2 := createTransaction(org.ID, debitTxAcc1.ID, creditTxAcc1.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "200.00")
			createAssignment(org.ID, tx2.ID, account1.ID, "200.00")

			// Transaction 3: Forward flow for account2 only
			tx3 := createTransaction(org.ID, creditTxAcc1.ID, debitTxAcc1.ID, time.Date(2024, 9, 15, 0, 0, 0, 0, time.UTC), "500.00")
			createAssignment(org.ID, tx3.ID, account2.ID, "500.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(2))

			// Find values by account
			var value1, value2 apd.Decimal
			for _, r := range result {
				if r.AccountID == account1.ID {
					value1 = r.Value
				}
				if r.AccountID == account2.ID {
					value2 = r.Value
				}
			}
			// account1: -1000 + 200 = -800
			expectDecimalEqual(value1, "-800.00")
			// account2: -500
			expectDecimalEqual(value2, "-500.00")
		})

		It("counts an expense between bank and unmarked account negatively", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Test Account")
			bank := createLedgerAccount(org.ID, "1800", &roleLiquidity)
			expense := createLedgerAccount(org.ID, "4000", nil)

			// Debit expense / credit bank => -500
			tx := createTransaction(org.ID, bank.ID, expense.ID, time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC), "500.00")
			createAssignment(org.ID, tx.ID, account.ID, "500.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			expectDecimalEqual(result[0].Value, "-500.00")
		})

		It("counts debitor billing positively and its settlement neutrally", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			billingAccount := createAccount(org.ID, "Dues")
			settlementAccount := createAccount(org.ID, "Bank-in")

			debitor := createLedgerAccount(org.ID, "1000", &roleCounter)
			bank := createLedgerAccount(org.ID, "1800", &roleLiquidity)
			revenue := createLedgerAccount(org.ID, "4000", nil)

			// Billing: debit debitor / credit revenue => +250
			billing := createTransaction(org.ID, revenue.ID, debitor.ID, time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC), "250.00")
			createAssignment(org.ID, billing.ID, billingAccount.ID, "250.00")

			// Settlement: debit bank / credit debitor => neutral (inner sphere)
			settlement := createTransaction(org.ID, debitor.ID, bank.ID, time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC), "250.00")
			createAssignment(org.ID, settlement.ID, settlementAccount.ID, "250.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(1))
			expectDecimalEqual(result[0].Value, "250.00")
		})

		It("counts a Forderungsverlust negatively and a kreditor invoice at booking time", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			lossAccount := createAccount(org.ID, "Forderungsverlust")
			invoiceAccount := createAccount(org.ID, "Rechnung")

			debitor := createLedgerAccount(org.ID, "1000", &roleCounter)
			kreditor := createLedgerAccount(org.ID, "3300", &roleCounter)
			bank := createLedgerAccount(org.ID, "1800", &roleLiquidity)
			expense := createLedgerAccount(org.ID, "4000", nil)

			// Forderungsverlust: debit expense / credit debitor => -120
			loss := createTransaction(org.ID, debitor.ID, expense.ID, time.Date(2024, 4, 1, 0, 0, 0, 0, time.UTC), "120.00")
			createAssignment(org.ID, loss.ID, lossAccount.ID, "120.00")

			// Kreditor invoice received: debit expense / credit kreditor => -80
			invoice := createTransaction(org.ID, kreditor.ID, expense.ID, time.Date(2024, 5, 1, 0, 0, 0, 0, time.UTC), "80.00")
			createAssignment(org.ID, invoice.ID, invoiceAccount.ID, "80.00")

			// Kreditor payment: debit kreditor / credit bank => neutral
			payment := createTransaction(org.ID, bank.ID, kreditor.ID, time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC), "80.00")
			createAssignment(org.ID, payment.ID, invoiceAccount.ID, "80.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(2))
			for _, r := range result {
				if r.AccountID == lossAccount.ID {
					expectDecimalEqual(r.Value, "-120.00")
				}
				if r.AccountID == invoiceAccount.ID {
					expectDecimalEqual(r.Value, "-80.00")
				}
			}
		})

		It("keeps movements between liquidity and counter accounts neutral", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Test Account")

			debitor := createLedgerAccount(org.ID, "1000", &roleCounter)
			bank := createLedgerAccount(org.ID, "1800", &roleLiquidity)

			// Loan given: debit counter / credit liquidity => neutral
			grant := createTransaction(org.ID, bank.ID, debitor.ID, time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC), "900.00")
			createAssignment(org.ID, grant.ID, account.ID, "900.00")

			// Payback: debit liquidity / credit counter => neutral
			payback := createTransaction(org.ID, debitor.ID, bank.ID, time.Date(2024, 7, 1, 0, 0, 0, 0, time.UTC), "300.00")
			createAssignment(org.ID, payback.ID, account.ID, "300.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(BeEmpty())
		})

		It("counts the opening reserve positively and a negative carry-forward negatively", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			reserveAccount := createAccount(org.ID, "Vortrag")

			bank := createLedgerAccount(org.ID, "1800", &roleLiquidity)
			startAccount := createLedgerAccount(org.ID, "9000", &roleStart)

			// Opening reserve: debit bank / credit start account => +1500
			opening := createTransaction(org.ID, startAccount.ID, bank.ID, time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC), "1500.00")
			createAssignment(org.ID, opening.ID, reserveAccount.ID, "1500.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(1))
			expectDecimalEqual(result[0].Value, "1500.00")

			// Negative carry-forward: debit start account / credit bank => -400
			carryForward := createTransaction(org.ID, bank.ID, startAccount.ID, time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC), "400.00")
			createAssignment(org.ID, carryForward.ID, reserveAccount.ID, "400.00")

			result, err = BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(1))
			expectDecimalEqual(result[0].Value, "1100.00")
		})

		It("keeps carried counter accounts at the opening neutral", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Test Account")

			debitor := createLedgerAccount(org.ID, "1000", &roleCounter)
			startAccount := createLedgerAccount(org.ID, "9000", &roleStart)

			// Carried receivable: debit counter / credit start account => neutral
			carried := createTransaction(org.ID, startAccount.ID, debitor.ID, time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC), "700.00")
			createAssignment(org.ID, carried.ID, account.ID, "700.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(BeEmpty())
		})

		It("keeps counter to counter and unmarked to unmarked bookings neutral", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Test Account")

			debitor := createLedgerAccount(org.ID, "1000", &roleCounter)
			kreditor := createLedgerAccount(org.ID, "3300", &roleCounter)
			revenue := createLedgerAccount(org.ID, "4000", nil)
			otherRevenue := createLedgerAccount(org.ID, "5000", nil)

			// Verrechnung: debit counter / credit counter => neutral
			offset := createTransaction(org.ID, kreditor.ID, debitor.ID, time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC), "60.00")
			createAssignment(org.ID, offset.ID, account.ID, "60.00")

			// Closing chain style booking: debit unmarked / credit unmarked => neutral
			closing := createTransaction(org.ID, otherRevenue.ID, revenue.ID, time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC), "60.00")
			createAssignment(org.ID, closing.ID, account.ID, "60.00")

			result, err := BudgetActualAccountValueRepo.ListByBudget(ctx, org.ID, startDate, endDate)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(BeEmpty())
		})
	})

	Describe("GetByBudgetAndAccount", func() {
		It("returns actual value for specific account", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Specific Account")
			creditTxAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc := createLedgerAccount(org.ID, "REV-001", nil)

			tx := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "1000.00")
			createAssignment(org.ID, tx.ID, account.ID, "1000.00")

			result, err := BudgetActualAccountValueRepo.GetByBudgetAndAccount(ctx, org.ID, startDate, endDate, account.CustomID)
			Expect(err).NotTo(HaveOccurred())
			Expect(result.AccountID).To(Equal(account.ID))
			Expect(result.AccountCustomID).To(Equal(account.CustomID))
			expectDecimalEqual(result.Value, "-1000.00")
		})

		It("returns not found when account has no transactions", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)
			account := createAccount(org.ID, "Unused Account")

			_, err := BudgetActualAccountValueRepo.GetByBudgetAndAccount(ctx, org.ID, startDate, endDate, account.CustomID)
			Expect(err).To(HaveOccurred())
			Expect(err).To(Equal(repository.ErrBudgetActualAccountValueNotFound))
		})

		It("returns not found for non-existent account", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			_, err := BudgetActualAccountValueRepo.GetByBudgetAndAccount(ctx, org.ID, startDate, endDate, "non-existent-id")
			Expect(err).To(HaveOccurred())
			Expect(err).To(Equal(repository.ErrBudgetActualAccountValueNotFound))
		})

		It("returns not found when all of the account's bookings are neutral", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Settlement Account")

			debitor := createLedgerAccount(org.ID, "1000", &roleCounter)
			bank := createLedgerAccount(org.ID, "1800", &roleLiquidity)

			// Only a neutral settlement booking exists for the account
			settlement := createTransaction(org.ID, debitor.ID, bank.ID, time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC), "250.00")
			createAssignment(org.ID, settlement.ID, account.ID, "250.00")

			_, err := BudgetActualAccountValueRepo.GetByBudgetAndAccount(ctx, org.ID, startDate, endDate, account.CustomID)
			Expect(err).To(Equal(repository.ErrBudgetActualAccountValueNotFound))
		})

		It("excludes transactions outside budget period", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Period Test Account")
			creditTxAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc := createLedgerAccount(org.ID, "REV-001", nil)

			// Create transaction outside period
			tx := createTransaction(org.ID, creditTxAcc.ID, debitTxAcc.ID, time.Date(2023, 6, 15, 0, 0, 0, 0, time.UTC), "1000.00")
			createAssignment(org.ID, tx.ID, account.ID, "1000.00")

			_, err := BudgetActualAccountValueRepo.GetByBudgetAndAccount(ctx, org.ID, startDate, endDate, account.CustomID)
			Expect(err).To(HaveOccurred())
			Expect(err).To(Equal(repository.ErrBudgetActualAccountValueNotFound))
		})

		It("returns correct net value with different credit/debit accounts", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Test Account")

			// Create two different pairs of ledger accounts
			creditTxAcc1 := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc1 := createLedgerAccount(org.ID, "REV-001", nil)
			creditTxAcc2 := createLedgerAccount(org.ID, "BANK-002", &roleLiquidity)
			debitTxAcc2 := createLedgerAccount(org.ID, "EXP-001", nil)

			// Transaction 1: BANK-001 -> REV-001
			tx1 := createTransaction(org.ID, creditTxAcc1.ID, debitTxAcc1.ID, time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC), "1000.00")
			createAssignment(org.ID, tx1.ID, account.ID, "1000.00")

			// Transaction 2: BANK-002 -> EXP-001 (different accounts)
			tx2 := createTransaction(org.ID, creditTxAcc2.ID, debitTxAcc2.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "2000.00")
			createAssignment(org.ID, tx2.ID, account.ID, "2000.00")

			result, err := BudgetActualAccountValueRepo.GetByBudgetAndAccount(ctx, org.ID, startDate, endDate, account.CustomID)
			Expect(err).NotTo(HaveOccurred())
			expectDecimalEqual(result.Value, "-3000.00")
		})

		It("returns correct net value when an expense is partially refunded via an income account", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Test Account")

			// Three distinct ledger accounts: 1800 (bank), 4000 (expense), 6000 (income)
			bank := createLedgerAccount(org.ID, "1800", &roleLiquidity)
			expense := createLedgerAccount(org.ID, "4000", nil)
			income := createLedgerAccount(org.ID, "6000", nil)

			// Expense: debit expense / credit bank => -100
			tx1 := createTransaction(org.ID, bank.ID, expense.ID, time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC), "100.00")
			createAssignment(org.ID, tx1.ID, account.ID, "100.00")

			// Partial refund: debit bank / credit income => +30
			tx2 := createTransaction(org.ID, income.ID, bank.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "30.00")
			createAssignment(org.ID, tx2.ID, account.ID, "30.00")

			result, err := BudgetActualAccountValueRepo.GetByBudgetAndAccount(ctx, org.ID, startDate, endDate, account.CustomID)
			Expect(err).NotTo(HaveOccurred())
			// Net = -100 + 30 = -70
			expectDecimalEqual(result.Value, "-70.00")
		})

		It("returns correct net value when debit becomes credit", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)

			account := createAccount(org.ID, "Test Account")

			creditTxAcc1 := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitTxAcc1 := createLedgerAccount(org.ID, "REV-001", nil)

			// Transaction 1: Forward flow
			tx1 := createTransaction(org.ID, creditTxAcc1.ID, debitTxAcc1.ID, time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC), "1000.00")
			createAssignment(org.ID, tx1.ID, account.ID, "1000.00")

			// Transaction 2: Reverse flow (debit becomes credit)
			tx2 := createTransaction(org.ID, debitTxAcc1.ID, creditTxAcc1.ID, time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC), "300.00")
			createAssignment(org.ID, tx2.ID, account.ID, "300.00")

			result, err := BudgetActualAccountValueRepo.GetByBudgetAndAccount(ctx, org.ID, startDate, endDate, account.CustomID)
			Expect(err).NotTo(HaveOccurred())
			// Net = -1000 + 300 = -700
			expectDecimalEqual(result.Value, "-700.00")
		})
	})

	Describe("ListByBudgets", func() {
		It("computes values per budget and honors the budget filter", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)
			budget1 := createBudget(org.ID, startDate, endDate)
			budget2 := createBudget(org.ID, startDate, endDate)

			account := createAccount(org.ID, "Test Account")
			bank := createLedgerAccount(org.ID, "1800", &roleLiquidity)
			expense := createLedgerAccount(org.ID, "4000", nil)

			for i, budget := range []*model.Budget{budget1, budget2} {
				tx := createTransaction(org.ID, bank.ID, expense.ID, time.Date(2024, 6, 15+i, 0, 0, 0, 0, time.UTC), "100.00")
				createAssignment(org.ID, tx.ID, account.ID, "100.00")
				_ = budget
			}

			result, err := BudgetActualAccountValueRepo.ListByBudgets(ctx, org.ID, nil, nil, nil)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(2))

			result, err = BudgetActualAccountValueRepo.ListByBudgets(ctx, org.ID, []string{budget1.CustomID}, nil, nil)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(1))
			Expect(result[0].BudgetCustomID).To(Equal(budget1.CustomID))
			// Both transactions lie within budget1's period, so budget1's
			// actual value is the sum of both.
			expectDecimalEqual(result[0].Value, "-200.00")
		})

		It("honors the document date range filter", func() {
			org := createOrganization("Test Org")
			startDate := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
			endDate := time.Date(2024, 12, 31, 0, 0, 0, 0, time.UTC)
			createBudget(org.ID, startDate, endDate)

			account := createAccount(org.ID, "Test Account")
			bank := createLedgerAccount(org.ID, "1800", &roleLiquidity)
			expense := createLedgerAccount(org.ID, "4000", nil)

			tx1 := createTransaction(org.ID, bank.ID, expense.ID, time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC), "100.00")
			createAssignment(org.ID, tx1.ID, account.ID, "100.00")
			tx2 := createTransaction(org.ID, bank.ID, expense.ID, time.Date(2024, 9, 15, 0, 0, 0, 0, time.UTC), "200.00")
			createAssignment(org.ID, tx2.ID, account.ID, "200.00")

			from := time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC)
			result, err := BudgetActualAccountValueRepo.ListByBudgets(ctx, org.ID, nil, &from, nil)
			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(HaveLen(1))
			expectDecimalEqual(result[0].Value, "-200.00")
		})
	})

	Describe("GetEffectiveInvertSigns", func() {
		It("returns false for unflagged accounts", func() {
			org := createOrganization("Test Org")
			account := createAccount(org.ID, "Plain")

			result, err := AccountRepo.GetEffectiveInvertSigns(ctx, org.ID, []uuid.UUID{account.ID})
			Expect(err).NotTo(HaveOccurred())
			Expect(result[account.ID]).To(BeFalse())
		})

		It("inherits inversion from the parent", func() {
			org := createOrganization("Test Org")
			parent, child := createAccountTree(org.ID, true, false)

			result, err := AccountRepo.GetEffectiveInvertSigns(ctx, org.ID, []uuid.UUID{parent.ID, child.ID})
			Expect(err).NotTo(HaveOccurred())
			Expect(result[parent.ID]).To(BeTrue())
			Expect(result[child.ID]).To(BeTrue())
		})

		It("keeps inversion enabled through an unflagged middle node", func() {
			org := createOrganization("Test Org")
			grandparent := createAccount(org.ID, "Grandparent")
			Expect(AccountRepo.Update(ctx, grandparent.ID, repository.UpdateAccountParams{
				InvertSign: optional.From(true),
			})).To(Succeed())
			middle := createAccount(org.ID, "Middle")
			Expect(AccountRepo.Update(ctx, middle.ID, repository.UpdateAccountParams{
				ParentAccountID: optional.From(uuid.NullUUID{UUID: grandparent.ID, Valid: true}),
			})).To(Succeed())
			leaf := createAccount(org.ID, "Leaf")
			Expect(AccountRepo.Update(ctx, leaf.ID, repository.UpdateAccountParams{
				ParentAccountID: optional.From(uuid.NullUUID{UUID: middle.ID, Valid: true}),
			})).To(Succeed())

			result, err := AccountRepo.GetEffectiveInvertSigns(ctx, org.ID, []uuid.UUID{leaf.ID})
			Expect(err).NotTo(HaveOccurred())
			Expect(result[leaf.ID]).To(BeTrue())
		})

		It("does not leak inversion across organizations", func() {
			org1 := createOrganization("Org 1")
			org2 := createOrganization("Org 2")
			flagged := createAccount(org1.ID, "Flagged")
			Expect(AccountRepo.Update(ctx, flagged.ID, repository.UpdateAccountParams{
				InvertSign: optional.From(true),
			})).To(Succeed())
			plain := createAccount(org2.ID, "Plain")

			result, err := AccountRepo.GetEffectiveInvertSigns(ctx, org2.ID, []uuid.UUID{plain.ID})
			Expect(err).NotTo(HaveOccurred())
			Expect(result[plain.ID]).To(BeFalse())
		})
	})
})
