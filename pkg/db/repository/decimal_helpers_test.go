package repository_test

import (
	"github.com/cockroachdb/apd/v3"
	. "github.com/onsi/gomega"
)

// expectDecimalEqual asserts that actual is numerically equal to want,
// independent of trailing-zero scale. SQLite stores decimal columns as
// integers, so "100.00" round-trips as "100"; assertions must not depend on
// the scale the database returns.
func expectDecimalEqual(actual apd.Decimal, want string) {
	var w apd.Decimal
	_, _, err := w.SetString(want)
	Expect(err).NotTo(HaveOccurred())
	Expect(actual.Cmp(&w)).To(Equal(0), "expected %s, got %s", want, actual.String())
}
