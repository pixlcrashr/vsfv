package services

import (
	"slices"
	"testing"
)

func TestSubmissionUpdateMaskResolvesGatewayDerivedMask(t *testing.T) {
	// A full-resource PATCH without an explicit mask makes grpc-gateway
	// derive the mask from every key of the JSON body (proto field names),
	// including output-only fields.
	gatewayMask := []string{
		"committee",
		"create_time",
		"delete_time",
		"etag",
		"income_expense",
		"income_expense.expense.person",
		"income_expense.expense.person.bank_transfer",
		"income_expense.scope",
		"name",
		"notice",
		"public_id",
		"status",
		"total_amount.value",
		"uid",
		"update_time",
	}

	got, err := submissionUpdateMask.resolve(gatewayMask)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}

	want := []string{
		"committee",
		"income_expense",
		"income_expense.expense.person",
		"income_expense.scope",
		"notice",
	}
	slices.Sort(got)
	if !slices.Equal(got, want) {
		t.Errorf("resolved mask = %v, want %v", got, want)
	}
}

func TestSubmissionUpdateMaskEmptyMeansFullUpdate(t *testing.T) {
	got, err := submissionUpdateMask.resolve(nil)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if got != nil {
		t.Errorf("resolve(empty) = %v, want nil (full update of mutable fields)", got)
	}
}

func TestSubmissionUpdateMaskExplicitPathsPassThrough(t *testing.T) {
	// "type" names the oneof, not a field, but is an accepted update path.
	got, err := submissionUpdateMask.resolve([]string{"notice", "type"})
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if !slices.Equal(got, []string{"notice", "type"}) {
		t.Errorf("resolved mask = %v, want [notice type]", got)
	}
}

func TestSubmissionUpdateMaskRejectsUnknownPath(t *testing.T) {
	if _, err := submissionUpdateMask.resolve([]string{"notice", "bank_details"}); err == nil {
		t.Error("resolve with unknown path should fail")
	}
}
