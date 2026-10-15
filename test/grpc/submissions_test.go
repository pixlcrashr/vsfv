package grpc_test

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/pixlcrashr/vsfv/pkg/grpc/gen"
)

// An expense draft may keep its settlement unset: the column is NULL in the
// database until the submitter picks a concrete settlement, and submitting
// validates the picked combination.
var _ = Describe("Submissions", func() {
	var orgID string

	createCommittee := func() string {
		resp, err := CommitteeClient.CreateCommittee(testCtx, &gen.CreateCommitteeRequest{
			Parent: "organizations/" + orgID,
			Committee: &gen.Committee{
				DisplayName: "Test Committee",
			},
		})
		Expect(err).NotTo(HaveOccurred())
		return resp.Name
	}

	createDraft := func(submission *gen.Submission) *gen.Submission {
		created, err := SubmissionClient.CreateSubmission(testCtx, &gen.CreateSubmissionRequest{
			Parent:     "organizations/" + orgID,
			Submission: submission,
		})
		Expect(err).NotTo(HaveOccurred())
		return created
	}

	createExpenseDraft := func(committeeName string) *gen.Submission {
		return createDraft(&gen.Submission{
			Committee: committeeName,
			Type: &gen.Submission_IncomeExpense{
				IncomeExpense: &gen.SubmissionTypeIncomeExpenseDetails{
					Scope: gen.SubmissionScope_SUBMISSION_SCOPE_NONPROFIT,
					Direction: &gen.SubmissionTypeIncomeExpenseDetails_Expense{
						Expense: &gen.SubmissionDirectionExpenseDetails{},
					},
				},
			},
		})
	}

	BeforeEach(func() {
		resp, err := OrgClient.CreateOrganization(testCtx, &gen.CreateOrganizationRequest{
			Organization: &gen.Organization{DisplayName: "Submissions Org"},
		})
		Expect(err).NotTo(HaveOccurred())
		orgID = resp.Uid
	})

	It("leaves the settlement unset for drafts created without one", func() {
		committeeName := createCommittee()
		created := createExpenseDraft(committeeName)
		Expect(created.GetIncomeExpense().GetExpense().GetSettlement()).To(BeNil())
	})

	It("stores no settlement for income submissions", func() {
		committeeName := createCommittee()
		created := createDraft(&gen.Submission{
			Committee: committeeName,
			Type: &gen.Submission_IncomeExpense{
				IncomeExpense: &gen.SubmissionTypeIncomeExpenseDetails{
					Scope: gen.SubmissionScope_SUBMISSION_SCOPE_NONPROFIT,
					Direction: &gen.SubmissionTypeIncomeExpenseDetails_Income{
						Income: &gen.SubmissionDirectionIncomeDetails{},
					},
				},
			},
		})
		Expect(created.GetIncomeExpense().GetIncome()).NotTo(BeNil())
		Expect(created.GetIncomeExpense().GetExpense()).To(BeNil())
	})

	It("round-trips a misc draft without a scope", func() {
		committeeName := createCommittee()
		created := createDraft(&gen.Submission{
			Committee: committeeName,
			Type:      &gen.Submission_Misc{Misc: &gen.SubmissionTypeMiscDetails{}},
		})
		Expect(created.GetMisc()).NotTo(BeNil())
		Expect(created.GetIncomeExpense()).To(BeNil())
	})

	It("clears the settlement on update when none is submitted", func() {
		committeeName := createCommittee()
		created := createExpenseDraft(committeeName)

		updated, err := SubmissionClient.UpdateSubmission(testCtx, &gen.UpdateSubmissionRequest{
			Submission: &gen.Submission{
				Name:      created.Name,
				Committee: committeeName,
				Type: &gen.Submission_IncomeExpense{
					IncomeExpense: &gen.SubmissionTypeIncomeExpenseDetails{
						Scope: gen.SubmissionScope_SUBMISSION_SCOPE_NONPROFIT,
						Direction: &gen.SubmissionTypeIncomeExpenseDetails_Expense{
							Expense: &gen.SubmissionDirectionExpenseDetails{},
						},
					},
				},
			},
		})
		Expect(err).NotTo(HaveOccurred())
		Expect(updated.GetIncomeExpense().GetExpense().GetSettlement()).To(BeNil())
	})

	It("rejects submitting an expense draft that still has no settlement", func() {
		committeeName := createCommittee()
		created := createExpenseDraft(committeeName)

		_, err := SubmissionClient.SubmitSubmission(testCtx, &gen.SubmitSubmissionRequest{
			Name: created.Name,
		})
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(ContainSubstring("settlement is required for expense submissions"))
	})

	It("submits after the settlement and details have been picked and an item was added", func() {
		committeeName := createCommittee()
		created := createExpenseDraft(committeeName)

		_, err := SubmissionClient.UpdateSubmission(testCtx, &gen.UpdateSubmissionRequest{
			Submission: &gen.Submission{
				Name:      created.Name,
				Committee: committeeName,
				Type: &gen.Submission_IncomeExpense{
					IncomeExpense: &gen.SubmissionTypeIncomeExpenseDetails{
						Scope: gen.SubmissionScope_SUBMISSION_SCOPE_NONPROFIT,
						Direction: &gen.SubmissionTypeIncomeExpenseDetails_Expense{
							Expense: &gen.SubmissionDirectionExpenseDetails{
								Settlement: &gen.SubmissionDirectionExpenseDetails_Person{
									Person: &gen.SubmissionSettlementPerson{
										PayoutMethod: &gen.SubmissionSettlementPerson_BankTransfer{
											BankTransfer: &gen.SubmissionPayoutMethodBankTransfer{
												BankAccount: &gen.BankAccount{
													AccountHolder: "Jane Doe",
													Iban:          "DE02120300000000202051",
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		})
		Expect(err).NotTo(HaveOccurred())

		_, err = SubmissionItemClient.CreateSubmissionItem(testCtx, &gen.CreateSubmissionItemRequest{
			Parent: created.Name,
			Item: &gen.SubmissionItem{
				Category: "invoice",
				Amount:   &gen.Decimal{Value: "50.00"},
			},
		})
		Expect(err).NotTo(HaveOccurred())

		submitted, err := SubmissionClient.SubmitSubmission(testCtx, &gen.SubmitSubmissionRequest{
			Name: created.Name,
		})
		Expect(err).NotTo(HaveOccurred())
		Expect(submitted.Status).To(Equal(gen.SubmissionStatus_SUBMISSION_STATUS_PENDING))
		person := submitted.GetIncomeExpense().GetExpense().GetPerson()
		Expect(person.GetBankTransfer().GetBankAccount().GetIban()).To(Equal("DE02120300000000202051"))
	})

	It("completes a misc submission directly upon approval", func() {
		committeeName := createCommittee()
		created := createDraft(&gen.Submission{
			Committee: committeeName,
			Type:      &gen.Submission_Misc{Misc: &gen.SubmissionTypeMiscDetails{}},
		})

		_, err := SubmissionItemClient.CreateSubmissionItem(testCtx, &gen.CreateSubmissionItemRequest{
			Parent: created.Name,
			Item: &gen.SubmissionItem{
				Category: "contract",
				Amount:   &gen.Decimal{Value: "0"},
			},
		})
		Expect(err).NotTo(HaveOccurred())

		_, err = SubmissionClient.SubmitSubmission(testCtx, &gen.SubmitSubmissionRequest{
			Name: created.Name,
		})
		Expect(err).NotTo(HaveOccurred())

		approved, err := SubmissionClient.ApproveSubmission(testCtx, &gen.ApproveSubmissionRequest{
			Name: created.Name,
		})
		Expect(err).NotTo(HaveOccurred())
		Expect(approved.Status).To(Equal(gen.SubmissionStatus_SUBMISSION_STATUS_COMPLETED))
	})
})
