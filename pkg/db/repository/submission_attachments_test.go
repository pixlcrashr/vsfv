package repository_test

import (
	"context"
	"errors"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

var _ = Describe("SubmissionAttachments", func() {
	var ctx context.Context

	// createItem creates an organization, a submission and a submission item
	// to attach blobs to.
	createItem := func() *model.SubmissionItem {
		org, err := OrganizationRepo.Create(ctx, repository.CreateOrganizationParams{
			DisplayName: "Org",
			CustomID:    uuid.New().String(),
		})
		Expect(err).NotTo(HaveOccurred())

		submission := &model.Submission{
			OrganizationID:  org.ID,
			CreatedByUserID: uuid.New(),
			CommitteeID:     uuid.New(),
			TotalAmount:     *apd.New(100, 0),
		}
		Expect(dbConn.Create(submission).Error).NotTo(HaveOccurred())

		item := &model.SubmissionItem{
			SubmissionID: submission.ID,
			Amount:       *apd.New(50, 0),
		}
		Expect(dbConn.Create(item).Error).NotTo(HaveOccurred())
		return item
	}

	// createAttachment uploads an attachment relation with an embedded data
	// item for the given item.
	createAttachment := func(itemID uuid.UUID) *model.SubmissionAttachment {
		m := &model.SubmissionAttachment{
			SubmissionItemID: itemID,
			DataItem: model.DataItem{
				ID:         uuid.New(),
				FileName:   "receipt.pdf",
				MimeType:   "application/pdf",
				FileSize:   1234,
				Sha256Sum:  "a1b2c3",
			},
		}
		Expect(SubmissionRepo.CreateAttachment(ctx, m)).To(Succeed())
		return m
	}

	BeforeEach(func() {
		ctx = context.Background()
	})

	Describe("DataItemRepository", func() {
		It("creates, reads and lists data items", func() {
			m := &model.DataItem{FileName: "a.pdf", MimeType: "application/pdf", FileSize: 1, Sha256Sum: "aa"}
			Expect(DataItemRepo.Create(ctx, m)).To(Succeed())
			Expect(m.ID).NotTo(Equal(uuid.Nil))

			got, err := DataItemRepo.GetByID(ctx, m.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(got.FileName).To(Equal("a.pdf"))

			all, err := DataItemRepo.ListAll(ctx)
			Expect(err).NotTo(HaveOccurred())
			Expect(all).To(HaveLen(1))
		})

		It("returns ErrDataItemNotFound for unknown IDs", func() {
			_, err := DataItemRepo.GetByID(ctx, uuid.New())
			Expect(errors.Is(err, repository.ErrDataItemNotFound)).To(BeTrue())
		})
	})

	Describe("CreateAttachment", func() {
		It("creates the data item and the relation in one step", func() {
			item := createItem()

			m := createAttachment(item.ID)
			Expect(m.ID).NotTo(Equal(uuid.Nil))
			Expect(m.DataItem.ID).NotTo(Equal(uuid.Nil))

			got, err := SubmissionRepo.GetAttachmentByID(ctx, m.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(got.SubmissionItemID).To(Equal(item.ID))
			Expect(got.DataItemID).To(Equal(m.DataItem.ID))
			Expect(got.DataItem.FileName).To(Equal("receipt.pdf"))
			Expect(got.DataItem.Sha256Sum).To(Equal("a1b2c3"))
		})
	})

	Describe("ListAttachments", func() {
		It("returns the attachments of an item with their data items", func() {
			item := createItem()
			other := createItem()

			first := createAttachment(item.ID)
			second := createAttachment(item.ID)
			createAttachment(other.ID)

			attachments, err := SubmissionRepo.ListAttachments(ctx, item.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(attachments).To(HaveLen(2))
			// Rows created within the same timestamp are ordered by id, so
			// only membership is asserted here.
			Expect([]uuid.UUID{attachments[0].ID, attachments[1].ID}).To(ContainElements(first.ID, second.ID))
			Expect(attachments[0].DataItem.FileName).To(Equal("receipt.pdf"))
		})
	})

	Describe("DeleteAttachment", func() {
		It("removes the relation and the data item", func() {
			item := createItem()
			m := createAttachment(item.ID)

			deleted, err := SubmissionRepo.DeleteAttachment(ctx, m.ID)
			Expect(err).NotTo(HaveOccurred())
			Expect(deleted.ID).To(Equal(m.ID))

			_, err = SubmissionRepo.GetAttachmentByID(ctx, m.ID)
			Expect(errors.Is(err, repository.ErrSubmissionAttachmentNotFound)).To(BeTrue())

			_, err = DataItemRepo.GetByID(ctx, m.DataItem.ID)
			Expect(errors.Is(err, repository.ErrDataItemNotFound)).To(BeTrue())
		})
	})
})
