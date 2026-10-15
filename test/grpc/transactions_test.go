package grpc_test

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// accRole returns a pointer to the given balance role.
func accType(v model.LedgerAccountType) *model.LedgerAccountType { return &v }

var _ = Describe("TransactionService", func() {
	var ctx context.Context
	var orgName string
	var creditLedgerAccountName string
	var debitLedgerAccountName string

	BeforeEach(func() {
		ctx = context.Background()
		org, err := OrgClient.CreateOrganization(ctx, &gen.CreateOrganizationRequest{
			Organization: &gen.Organization{DisplayName: "Test Org for Transactions"},
		})
		Expect(err).NotTo(HaveOccurred())
		orgName = org.Name

		var orgRN gen.OrganizationResourceName
		Expect(orgRN.UnmarshalString(orgName)).To(Succeed())

		orgUID, err := uuid.Parse(org.Uid)
		Expect(err).NotTo(HaveOccurred())

		// Create two ledger accounts as prerequisites (no Create RPC, use repo directly)
		creditAccount, err := LedgerAccountRepo.Create(ctx, repository.CreateLedgerAccountParams{
			OrganizationID: orgUID,
			Code:           "CREDIT-ACC",
			Type:           accType(model.LedgerAccountTypeLiquidity),
			DisplayName:    "Credit Account",
		})
		Expect(err).NotTo(HaveOccurred())
		creditLedgerAccountName = orgRN.LedgerAccountResourceName(creditAccount.CustomID).String()

		debitAccount, err := LedgerAccountRepo.Create(ctx, repository.CreateLedgerAccountParams{
			OrganizationID: orgUID,
			Code:           "DEBIT-ACC",
			Type:           nil,
			DisplayName:    "Debit Account",
		})
		Expect(err).NotTo(HaveOccurred())
		debitLedgerAccountName = orgRN.LedgerAccountResourceName(debitAccount.CustomID).String()
	})

	Describe("CreateTransaction", func() {
		It("creates a transaction and returns it with server-populated fields", func() {
			resp, err := TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
				Transaction: &gen.Transaction{
					CreditLedgerAccount: creditLedgerAccountName,
					DebitLedgerAccount:  debitLedgerAccountName,
					Description:         "Test transaction",
					Reference:           "REF-001",
					BookedAt:            timestamppb.New(time.Now()),
					DocumentDate:        timestamppb.New(time.Now()),
				},
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.Name).NotTo(BeEmpty())
			Expect(resp.Uid).NotTo(BeEmpty())
			Expect(resp.CreditLedgerAccount).To(Equal(creditLedgerAccountName))
			Expect(resp.DebitLedgerAccount).To(Equal(debitLedgerAccountName))
			Expect(resp.Description).To(Equal("Test transaction"))
			Expect(resp.Reference).To(Equal("REF-001"))
			Expect(resp.CreateTime).NotTo(BeNil())
			Expect(resp.UpdateTime).NotTo(BeNil())
		})

		It("creates a transaction without optional dates", func() {
			resp, err := TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
				Transaction: &gen.Transaction{
					CreditLedgerAccount: creditLedgerAccountName,
					DebitLedgerAccount:  debitLedgerAccountName,
					Description:         "Simple transaction",
				},
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.Description).To(Equal("Simple transaction"))
		})

		It("returns InvalidArgument when transaction body is missing", func() {
			_, err := TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})

		It("returns InvalidArgument when credit_ledger_account is invalid", func() {
			_, err := TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
				Transaction: &gen.Transaction{
					CreditLedgerAccount: "invalid-name",
					DebitLedgerAccount:  debitLedgerAccountName,
				},
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})

		It("returns InvalidArgument when debit_ledger_account is invalid", func() {
			_, err := TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
				Transaction: &gen.Transaction{
					CreditLedgerAccount: creditLedgerAccountName,
					DebitLedgerAccount:  "invalid-name",
				},
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})

	Describe("GetTransaction", func() {
		var created *gen.Transaction

		BeforeEach(func() {
			var err error
			created, err = TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
				Transaction: &gen.Transaction{
					CreditLedgerAccount: creditLedgerAccountName,
					DebitLedgerAccount:  debitLedgerAccountName,
					Description:         "Get Test Transaction",
					Reference:           "GET-REF",
				},
			})
			Expect(err).NotTo(HaveOccurred())
		})

		It("retrieves the transaction by resource name", func() {
			resp, err := TransactionClient.GetTransaction(ctx, &gen.GetTransactionRequest{Name: created.Name})
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.Name).To(Equal(created.Name))
			Expect(resp.Uid).To(Equal(created.Uid))
			Expect(resp.Description).To(Equal("Get Test Transaction"))
			Expect(resp.Reference).To(Equal("GET-REF"))
		})

		It("returns NotFound for an unknown resource name", func() {
			_, err := TransactionClient.GetTransaction(ctx, &gen.GetTransactionRequest{
				Name: "organizations/00000000-0000-0000-0000-000000000000/transactions/00000000-0000-0000-0000-000000000000",
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns InvalidArgument for a malformed resource name", func() {
			_, err := TransactionClient.GetTransaction(ctx, &gen.GetTransactionRequest{Name: "not-valid"})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})

	Describe("ListTransactions", func() {
		BeforeEach(func() {
			for i := 0; i < 3; i++ {
				_, err := TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
					Parent: orgName,
					Transaction: &gen.Transaction{
						CreditLedgerAccount: creditLedgerAccountName,
						DebitLedgerAccount:  debitLedgerAccountName,
						Description:         fmt.Sprintf("List Test Transaction %d", i),
						Reference:           fmt.Sprintf("LIST-REF-%d", i),
						BookedAt:            timestamppb.New(time.Now().Add(time.Duration(i) * time.Hour)),
					},
				})
				Expect(err).NotTo(HaveOccurred())
			}
		})

		It("lists all created transactions", func() {
			resp, err := TransactionClient.ListTransactions(ctx, &gen.ListTransactionsRequest{
				Parent:   orgName,
				PageSize: 100,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(len(resp.Transactions)).To(BeNumerically(">=", 3))
		})

		It("respects page_size and returns a next_page_token when more results exist", func() {
			resp, err := TransactionClient.ListTransactions(ctx, &gen.ListTransactionsRequest{
				Parent:   orgName,
				PageSize: 1,
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(len(resp.Transactions)).To(Equal(1))
			Expect(resp.NextPageToken).NotTo(BeEmpty())
		})

		It("traverses all pages via page tokens", func() {
			var all []*gen.Transaction
			var token string
			for {
				resp, err := TransactionClient.ListTransactions(ctx, &gen.ListTransactionsRequest{
					Parent:    orgName,
					PageSize:  2,
					PageToken: token,
				})
				Expect(err).NotTo(HaveOccurred())
				all = append(all, resp.Transactions...)
				if resp.NextPageToken == "" {
					break
				}
				token = resp.NextPageToken
			}
			Expect(len(all)).To(BeNumerically(">=", 3))
		})
	})

	Describe("UpdateTransaction", func() {
		var created *gen.Transaction

		BeforeEach(func() {
			var err error
			created, err = TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
				Transaction: &gen.Transaction{
					CreditLedgerAccount: creditLedgerAccountName,
					DebitLedgerAccount:  debitLedgerAccountName,
					Description:         "Before Update",
					Reference:           "BEFORE-REF",
				},
			})
			Expect(err).NotTo(HaveOccurred())
		})

		It("keeps the description immutable and updates the reference", func() {
			updated, err := TransactionClient.UpdateTransaction(ctx, &gen.UpdateTransactionRequest{
				Transaction: &gen.Transaction{
					Name:        created.Name,
					Description: "After Update",
					Reference:   "AFTER-REF",
				},
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(updated.Description).To(Equal("Before Update"))
			Expect(updated.Reference).To(Equal("AFTER-REF"))
			Expect(updated.Name).To(Equal(created.Name))
		})

		It("rejects update masks that target the description", func() {
			_, err := TransactionClient.UpdateTransaction(ctx, &gen.UpdateTransactionRequest{
				Transaction: &gen.Transaction{
					Name: created.Name,
				},
				UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"description"}},
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})

		It("updates the booked_at and document_date", func() {
			newTime := timestamppb.New(time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC))
			updated, err := TransactionClient.UpdateTransaction(ctx, &gen.UpdateTransactionRequest{
				Transaction: &gen.Transaction{
					Name:         created.Name,
					Description:  created.Description,
					BookedAt:     newTime,
					DocumentDate: newTime,
				},
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(updated.BookedAt).NotTo(BeNil())
			Expect(updated.DocumentDate).NotTo(BeNil())
		})

		It("returns NotFound when updating a non-existent transaction", func() {
			_, err := TransactionClient.UpdateTransaction(ctx, &gen.UpdateTransactionRequest{
				Transaction: &gen.Transaction{
					Name:        "organizations/00000000-0000-0000-0000-000000000000/transactions/00000000-0000-0000-0000-000000000000",
					Description: "Ghost",
				},
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns InvalidArgument when transaction body is missing", func() {
			_, err := TransactionClient.UpdateTransaction(ctx, &gen.UpdateTransactionRequest{})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})

	Describe("DeleteTransaction", func() {
		var created *gen.Transaction

		BeforeEach(func() {
			var err error
			created, err = TransactionClient.CreateTransaction(ctx, &gen.CreateTransactionRequest{
				Parent: orgName,
				Transaction: &gen.Transaction{
					CreditLedgerAccount: creditLedgerAccountName,
					DebitLedgerAccount:  debitLedgerAccountName,
					Description:         "To Delete",
				},
			})
			Expect(err).NotTo(HaveOccurred())
		})

		It("permanently deletes the transaction", func() {
			_, err := TransactionClient.DeleteTransaction(ctx, &gen.DeleteTransactionRequest{Name: created.Name})
			Expect(err).NotTo(HaveOccurred())

			_, err = TransactionClient.GetTransaction(ctx, &gen.GetTransactionRequest{Name: created.Name})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns NotFound when deleting a non-existent transaction", func() {
			_, err := TransactionClient.DeleteTransaction(ctx, &gen.DeleteTransactionRequest{
				Name: "organizations/00000000-0000-0000-0000-000000000000/transactions/00000000-0000-0000-0000-000000000000",
			})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.NotFound))
		})

		It("returns InvalidArgument for a malformed resource name", func() {
			_, err := TransactionClient.DeleteTransaction(ctx, &gen.DeleteTransactionRequest{Name: "bad-name"})
			Expect(err).To(HaveOccurred())
			Expect(status.Code(err)).To(Equal(codes.InvalidArgument))
		})
	})
})
