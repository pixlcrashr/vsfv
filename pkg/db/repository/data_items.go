package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"gorm.io/gorm"
)

var ErrDataItemNotFound = errors.New("data item not found")

// DataItemRepository provides queries for the internal data item table
// (metadata of binary blobs in the global FileStorage). Data items are not
// exposed through the public API; concrete use cases manage them through
// their own relation tables and repositories.
type DataItemRepository struct {
	db *gorm.DB
}

// NewDataItemRepository creates a DataItemRepository backed by db.
func NewDataItemRepository(db *gorm.DB) *DataItemRepository {
	return &DataItemRepository{db: db}
}

// Create inserts new data item metadata.
func (r *DataItemRepository) Create(ctx context.Context, m *model.DataItem) error {
	if err := r.db.WithContext(ctx).Create(m).Error; err != nil {
		return fmt.Errorf("create data item file_name=%s: %w", m.FileName, err)
	}
	return nil
}

// GetByID returns the data item with the given ID.
func (r *DataItemRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.DataItem, error) {
	var m model.DataItem
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.Join(ErrDataItemNotFound, fmt.Errorf("id=%s: %w", id, err))
		}
		return nil, fmt.Errorf("get data item id=%s: %w", id, err)
	}
	return &m, nil
}

// ListAll returns every data item, oldest first. It is the basis for
// whole-table file verification (re-hashing each data item's file and
// comparing against its sha256_sum).
func (r *DataItemRepository) ListAll(ctx context.Context) ([]*model.DataItem, error) {
	var ms []*model.DataItem
	err := r.db.WithContext(ctx).Order("created_at ASC, id ASC").Find(&ms).Error
	if err != nil {
		return nil, fmt.Errorf("list data items: %w", err)
	}
	return ms, nil
}

// Delete removes the data item with the given ID. Callers are responsible
// for deleting the binary from storage.
func (r *DataItemRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if err := r.db.WithContext(ctx).Delete(&model.DataItem{}, id).Error; err != nil {
		return fmt.Errorf("delete data item id=%s: %w", id, err)
	}
	return nil
}
