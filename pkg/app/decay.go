// Decay sweeper: automatically rejects pending submissions once the
// organization-wide submission deadline has passed.
package app

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/audit"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	"gorm.io/gorm"
)

// runSubmissionDecaySweeper periodically rejects all pending and
// further-info submissions of every organization whose submission deadline
// has passed. It returns when stop is closed.
func runSubmissionDecaySweeper(ctx context.Context, db *gorm.DB, interval time.Duration, stop <-chan struct{}) {
	orgRepo := repository.NewOrganizationRepository(db)
	settingsRepo := repository.NewOrganizationSubmissionSettingsRepository(db)
	submissionRepo := repository.NewSubmissionRepository(db)
	audits := audit.NewWriter(db)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	sweep := func() {
		orgs, _, err := orgRepo.List(ctx, repository.ListOrganizationsParams{PageSize: 1000})
		if err != nil {
			return
		}
		now := time.Now().UTC()
		for _, org := range orgs {
			settings, err := settingsRepo.GetOrDefault(ctx, org.ID)
			if err != nil || settings.SubmissionDeadline == nil {
				continue
			}
			d := *settings.SubmissionDeadline
			deadline := time.Date(d.Year(), d.Month(), d.Day(), 23, 59, 59, 0, time.UTC)
			if now.Before(deadline) {
				continue
			}

			subs, err := submissionRepo.ListDecayable(ctx, org.ID)
			if err != nil {
				continue
			}
			for _, sub := range subs {
				if err := submissionRepo.UpdateStatus(ctx, sub.ID, sub.Status, model.SubmissionStatusRejected); err != nil {
					continue
				}
				comment := &model.SubmissionComment{
					SubmissionID: sub.ID,
					Content:      "Automatically rejected: the organization-wide submission deadline has passed.",
					IsAdminOnly:  false,
					StatusFrom:   int32(sub.Status),
					StatusTo:     int32(model.SubmissionStatusRejected),
				}
				_ = submissionRepo.CreateComment(ctx, comment)

				resourceName := (&gen.SubmissionResourceName{
					Organization: org.ID.String(),
					Submission:   sub.ID.String(),
				}).String()
				_ = audits.Record(ctx, audit.Subject{
					ResourceName:   resourceName,
					ResourceID:     sub.ID,
					OrganizationID: toNullUUID(org.ID),
				}, "decay", sub, nil)
			}
		}
	}

	sweep()
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			sweep()
		}
	}
}

func toNullUUID(id uuid.UUID) uuid.NullUUID {
	return uuid.NullUUID{Valid: true, UUID: id}
}
