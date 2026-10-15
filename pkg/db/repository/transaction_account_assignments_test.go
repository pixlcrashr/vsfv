package repository_test

import (
	"context"
	"fmt"
	"time"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	"github.com/theater-improrama/go-utils/optional"
)

var _ = Describe("TransactionAssignments", func() {
	var ctx context.Context

	createOrganization := func(name string) *model.Organization {
		org, err := OrganizationRepo.Create(ctx, repository.CreateOrganizationParams{
			DisplayName: name,
			CustomID:    uuid.New().String(),
		})
		Expect(err).NotTo(HaveOccurred())
		return org
	}

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

	roleLiquidity := model.LedgerAccountTypeLiquidity

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

	// txCounter makes each created transaction distinguishable so bookings
	// within one spec do not collide on the journal_key dedup key.
	txCounter := 0
	createTransaction := func(orgID, creditLedgerAccID, debitLedgerAccID uuid.UUID) *model.Transaction_ {
		txCounter++
		docDate := time.Date(2024, 6, 15, 0, 0, 0, 0, time.UTC)
		tx, err := TransactionRepo.Create(ctx, repository.CreateTransactionParams{
			OrganizationID:        orgID,
			CreditLedgerAccountID: creditLedgerAccID,
			DebitLedgerAccountID:  debitLedgerAccID,
			Description:           fmt.Sprintf("Test transaction %d", txCounter),
			DocumentDate:          docDate,
			BookedAt:              docDate,
		})
		Expect(err).NotTo(HaveOccurred())
		return tx
	}

	value := func(s string) apd.Decimal {
		var d apd.Decimal
		_, _, err := d.SetString(s)
		Expect(err).NotTo(HaveOccurred())
		return d
	}

	Describe("Create", func() {
		It("creates an assignment for a transaction that has none yet", func() {
			org := createOrganization("Test Org")
			account := createAccount(org.ID, "Test Account")
			creditAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitAcc := createLedgerAccount(org.ID, "REV-001", nil)
			tx := createTransaction(org.ID, creditAcc.ID, debitAcc.ID)

			m, err := TransactionAssignmentRepo.Create(ctx, repository.CreateTransactionAssignmentParams{
				OrganizationID: org.ID,
				TransactionID:  tx.ID,
				AccountID:      account.ID,
				Value:          value("100.00"),
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(m.AccountID).To(Equal(account.ID))
		})

		It("rejects a second assignment for the same transaction and account", func() {
			org := createOrganization("Test Org")
			account := createAccount(org.ID, "Account A")
			creditAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitAcc := createLedgerAccount(org.ID, "REV-001", nil)
			tx := createTransaction(org.ID, creditAcc.ID, debitAcc.ID)

			_, err := TransactionAssignmentRepo.Create(ctx, repository.CreateTransactionAssignmentParams{
				OrganizationID: org.ID,
				TransactionID:  tx.ID,
				AccountID:      account.ID,
				Value:          value("100.00"),
			})
			Expect(err).NotTo(HaveOccurred())

			_, err = TransactionAssignmentRepo.Create(ctx, repository.CreateTransactionAssignmentParams{
				OrganizationID: org.ID,
				TransactionID:  tx.ID,
				AccountID:      account.ID,
				Value:          value("50.00"),
			})
			Expect(err).To(HaveOccurred())
			Expect(err).To(MatchError(repository.ErrTransactionAssignmentAlreadyExists))
		})

		It("allows assignments for the same transaction on different accounts", func() {
			org := createOrganization("Test Org")
			account1 := createAccount(org.ID, "Account A")
			account2 := createAccount(org.ID, "Account B")
			creditAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitAcc := createLedgerAccount(org.ID, "REV-001", nil)
			tx := createTransaction(org.ID, creditAcc.ID, debitAcc.ID)

			_, err := TransactionAssignmentRepo.Create(ctx, repository.CreateTransactionAssignmentParams{
				OrganizationID: org.ID,
				TransactionID:  tx.ID,
				AccountID:      account1.ID,
				Value:          value("100.00"),
			})
			Expect(err).NotTo(HaveOccurred())

			_, err = TransactionAssignmentRepo.Create(ctx, repository.CreateTransactionAssignmentParams{
				OrganizationID: org.ID,
				TransactionID:  tx.ID,
				AccountID:      account2.ID,
				Value:          value("50.00"),
			})
			Expect(err).NotTo(HaveOccurred())
		})

		It("allows assignments for different transactions", func() {
			org := createOrganization("Test Org")
			account := createAccount(org.ID, "Test Account")
			creditAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitAcc := createLedgerAccount(org.ID, "REV-001", nil)
			tx1 := createTransaction(org.ID, creditAcc.ID, debitAcc.ID)
			tx2 := createTransaction(org.ID, creditAcc.ID, debitAcc.ID)

			_, err := TransactionAssignmentRepo.Create(ctx, repository.CreateTransactionAssignmentParams{
				OrganizationID: org.ID,
				TransactionID:  tx1.ID,
				AccountID:      account.ID,
				Value:          value("100.00"),
			})
			Expect(err).NotTo(HaveOccurred())

			_, err = TransactionAssignmentRepo.Create(ctx, repository.CreateTransactionAssignmentParams{
				OrganizationID: org.ID,
				TransactionID:  tx2.ID,
				AccountID:      account.ID,
				Value:          value("100.00"),
			})
			Expect(err).NotTo(HaveOccurred())
		})
	})

	Describe("Update", func() {
		It("allows changing the account of the sole assignment for a transaction", func() {
			org := createOrganization("Test Org")
			account1 := createAccount(org.ID, "Account A")
			account2 := createAccount(org.ID, "Account B")
			creditAcc := createLedgerAccount(org.ID, "BANK-001", &roleLiquidity)
			debitAcc := createLedgerAccount(org.ID, "REV-001", nil)
			tx := createTransaction(org.ID, creditAcc.ID, debitAcc.ID)

			m, err := TransactionAssignmentRepo.Create(ctx, repository.CreateTransactionAssignmentParams{
				OrganizationID: org.ID,
				TransactionID:  tx.ID,
				AccountID:      account1.ID,
				Value:          value("100.00"),
			})
			Expect(err).NotTo(HaveOccurred())

			err = TransactionAssignmentRepo.Update(ctx, m.ID, repository.UpdateTransactionAssignmentParams{
				AccountID: optional.From(account2.ID),
			})
			Expect(err).NotTo(HaveOccurred())

			updated, err := TransactionAssignmentRepo.GetByID(ctx, m.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(updated.AccountID).To(Equal(account2.ID))
		})
	})
})
