package db

import (
	"context"

	"gorm.io/gorm"
)

// Transact runs fn inside a single database transaction on db (gorm's
// Transaction wrapper). It is the standard way for any caller — gRPC
// services, Huma endpoints, background jobs — to keep all of its statements
// (including audit writes) atomic. The closure must derive its repositories
// from a repository.Factory built on tx (and its audit writer from
// audit.NewWriter(tx)) so every statement joins the transaction. The error
// returned by fn is passed through unchanged; on error the transaction is
// rolled back, otherwise it is committed.
func Transact[R any](ctx context.Context, db *gorm.DB, fn func(tx *gorm.DB) (R, error)) (R, error) {
	var out R
	err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var err error
		out, err = fn(tx)
		return err
	})
	if err != nil {
		var zero R
		return zero, err
	}
	return out, nil
}

// TransactVoid is Transact for callers that return no value.
func TransactVoid(ctx context.Context, db *gorm.DB, fn func(tx *gorm.DB) error) error {
	return db.WithContext(ctx).Transaction(fn)
}
