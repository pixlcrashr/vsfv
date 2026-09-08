// Package filter provides AIP-160-compliant filter parsing for each gRPC
// service entity. Each entity exposes:
//   - A ParseXxxFilter(raw string) function that validates the filter string
//     against a schema of declared identifiers and returns an abstract cond.Cond.
//
// The returned cond.Cond supports nested boolean logic (AND, OR, NOT) with
// a maximum nesting depth of 3 levels.
//
// Supported AIP-160 operators:
//   - =   equality              (e.g. is_archived=true)
//   - !=  inequality            (e.g. is_closed!=false)
//   - <, <=, >, >=  comparison  (e.g. year>=2024)
//   - :   has / substring       (e.g. display_name:"foo")
//   - AND / OR / NOT            boolean combinators
package filter

import (
	"fmt"
	"strings"
	"time"

	"github.com/pixlcrashr/vsfv/pkg/query/cond"
	"go.einride.tech/aip/filtering"
	expr "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
)

// ── shared helpers ────────────────────────────────────────────────────────────

// parseWith parses a raw AIP-160 filter string against the provided
// declarations. Returns nil when raw is empty (no filter applied).
func parseWith(raw string, decls *filtering.Declarations) (*filtering.Filter, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	f, err := filtering.ParseFilterString(raw, decls)
	if err != nil {
		return nil, fmt.Errorf("invalid filter: %w", err)
	}
	return &f, nil
}

// mustDecls builds a Declarations instance, panicking on error (programming bug).
func mustDecls(opts ...filtering.DeclarationOption) *filtering.Declarations {
	all := make([]filtering.DeclarationOption, 0, len(opts)+1)
	all = append(all, filtering.DeclareStandardFunctions())
	all = append(all, opts...)
	d, err := filtering.NewDeclarations(all...)
	if err != nil {
		panic("filter: declarations error: " + err.Error())
	}
	return d
}

// ── constant extractors ───────────────────────────────────────────────────────

func stringVal(c *expr.Constant) (string, bool) {
	if s, ok := c.ConstantKind.(*expr.Constant_StringValue); ok {
		return s.StringValue, true
	}
	return "", false
}

func boolVal(c *expr.Constant) (bool, bool) {
	if b, ok := c.ConstantKind.(*expr.Constant_BoolValue); ok {
		return b.BoolValue, true
	}
	return false, false
}

func int64Val(c *expr.Constant) (int64, bool) {
	if i, ok := c.ConstantKind.(*expr.Constant_Int64Value); ok {
		return i.Int64Value, true
	}
	return 0, false
}

// ── per-entity declarations (package-level singletons) ─────────────────────

var (
	acctDecls = mustDecls(
		filtering.DeclareIdent("display_name", filtering.TypeString),
		filtering.DeclareIdent("display_code", filtering.TypeString),
		filtering.DeclareIdent("is_archived", filtering.TypeBool),
	)
	acctGroupDecls = mustDecls(
		filtering.DeclareIdent("display_name", filtering.TypeString),
	)
	acctGroupAssignmentDecls = mustDecls(
		filtering.DeclareIdent("account_id", filtering.TypeString),
		filtering.DeclareIdent("negate", filtering.TypeBool),
	)
	budgetDecls = mustDecls(
		filtering.DeclareIdent("display_name", filtering.TypeString),
		filtering.DeclareIdent("is_closed", filtering.TypeBool),
	)
	budgetRevisionDecls = mustDecls(
		filtering.DeclareIdent("display_name", filtering.TypeString),
		filtering.DeclareIdent("display_description", filtering.TypeString),
		filtering.DeclareIdent("date", filtering.TypeString),
	)
	budgetRevisionAccountValueDecls = mustDecls(
		filtering.DeclareIdent("account", filtering.TypeString),
	)
	budgetAccountValueDecls = mustDecls(
		filtering.DeclareIdent("account", filtering.TypeString),
	)
	budgetActualAccountValueDecls = mustDecls(
		filtering.DeclareIdent("account", filtering.TypeString),
		filtering.DeclareIdent("budget", filtering.TypeString),
		filtering.DeclareIdent("document_date", filtering.TypeString),
	)
	organizationDecls = mustDecls(
		filtering.DeclareIdent("display_name", filtering.TypeString),
	)
	ledgerYearDecls = mustDecls(
		filtering.DeclareIdent("year", filtering.TypeInt),
		filtering.DeclareIdent("is_closed", filtering.TypeBool),
	)
	transactionDecls = mustDecls(
		filtering.DeclareIdent("credit_ledger_account", filtering.TypeString),
		filtering.DeclareIdent("debit_ledger_account", filtering.TypeString),
		filtering.DeclareIdent("booked_at", filtering.TypeString),
	)
	ledgerAccountDecls = mustDecls(
		filtering.DeclareIdent("code", filtering.TypeString),
		filtering.DeclareIdent("account_type", filtering.TypeString),
		filtering.DeclareIdent("display_name", filtering.TypeString),
	)
	transactionAssignmentDecls = mustDecls(
		filtering.DeclareIdent("account", filtering.TypeString),
		filtering.DeclareIdent("transaction", filtering.TypeString),
	)
	reportTemplateDecls = mustDecls(
		filtering.DeclareIdent("display_name", filtering.TypeString),
	)
	reportDecls = mustDecls(
		filtering.DeclareIdent("display_name", filtering.TypeString),
	)
	userDecls = mustDecls(
		filtering.DeclareIdent("display_name", filtering.TypeString),
		filtering.DeclareIdent("email", filtering.TypeString),
		filtering.DeclareIdent("is_active", filtering.TypeBool),
	)
	userGroupDecls = mustDecls(
		filtering.DeclareIdent("display_name", filtering.TypeString),
	)
	auditLogEntryDecls = mustDecls(
		filtering.DeclareIdent("resource", filtering.TypeString),
		filtering.DeclareIdent("actor", filtering.TypeString),
		filtering.DeclareIdent("action", filtering.TypeString),
		filtering.DeclareIdent("organization", filtering.TypeString),
		filtering.DeclareIdent("timestamp", filtering.TypeString),
	)
)

// maxFilterDepth is the maximum nesting level for filter conditions (AND/OR/NOT).
const maxFilterDepth = 3

// ── Account ──────────────────────────────────────────────────────────────────

// ParseAccountFilter parses an AIP-160 filter string into an abstract condition chain.
// The returned cond.Cond preserves AND, OR, NOT logical operators and uses filter
// field names (not DB columns). Returns nil for empty filter.
func ParseAccountFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, acctDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// buildCond recursively builds a cond.Cond from a CEL expression.
// depth tracks the current nesting level; returns error if maxFilterDepth is exceeded.
func buildCond(e *expr.Expr, depth int) (cond.Cond, error) {
	if depth > maxFilterDepth {
		return nil, fmt.Errorf("filter nesting exceeds maximum depth of %d", maxFilterDepth)
	}
	if e == nil {
		return nil, nil
	}

	// Handle call expressions (operators and functions)
	if call := e.GetCallExpr(); call != nil {
		return buildCallCond(call, depth)
	}

	// Handle identifiers (bare boolean field like "is_archived")
	if ident := e.GetIdentExpr(); ident != nil {
		return cond.Eq(ident.GetName(), true), nil
	}

	return nil, nil
}

// buildCallCond builds a cond.Cond from a CEL call expression.
func buildCallCond(call *expr.Expr_Call, depth int) (cond.Cond, error) {
	fn := call.GetFunction()
	args := call.GetArgs()

	nextDepth := depth + 1
	switch fn {
	case filtering.FunctionAnd, filtering.FunctionFuzzyAnd:
		return buildAndCond(args, nextDepth)
	case filtering.FunctionOr:
		return buildOrCond(args, nextDepth)
	case filtering.FunctionNot:
		if len(args) == 1 {
			inner, err := buildCond(args[0], nextDepth)
			if err != nil {
				return nil, err
			}
			return cond.Not(inner), nil
		}
		return nil, fmt.Errorf("NOT requires exactly 1 argument, got %d", len(args))

	case filtering.FunctionEquals, filtering.FunctionNotEquals,
		filtering.FunctionLessThan, filtering.FunctionLessEquals,
		filtering.FunctionGreaterThan, filtering.FunctionGreaterEquals:
		return buildComparisonCond(fn, args)

	case filtering.FunctionHas:
		return buildHasCond(args)

	default:
		return nil, fmt.Errorf("unsupported filter function: %s", fn)
	}
}

// buildAndCond builds an AND condition. Nested AND chains (produced by CEL's
// left-associative parsing of a AND b AND c ...) are flattened without
// incrementing depth, so a long conjunction does not exceed maxFilterDepth.
func buildAndCond(args []*expr.Expr, depth int) (cond.Cond, error) {
	var conds []cond.Cond
	for _, arg := range args {
		// Flatten nested AND calls without incrementing depth.
		if call := arg.GetCallExpr(); call != nil && (call.GetFunction() == filtering.FunctionAnd || call.GetFunction() == filtering.FunctionFuzzyAnd) {
			c, err := buildAndCond(call.GetArgs(), depth)
			if err != nil {
				return nil, err
			}
			if c != nil && !c.IsEmpty() {
				conds = append(conds, c)
			}
			continue
		}
		c, err := buildCond(arg, depth)
		if err != nil {
			return nil, err
		}
		if c != nil && !c.IsEmpty() {
			conds = append(conds, c)
		}
	}
	if len(conds) == 0 {
		return nil, nil
	}
	return cond.And(conds...), nil
}

// buildOrCond builds an OR condition. Nested OR chains (produced by CEL's
// left-associative parsing of a OR b OR c ...) are flattened without
// incrementing depth, so a long disjunction does not exceed maxFilterDepth.
func buildOrCond(args []*expr.Expr, depth int) (cond.Cond, error) {
	var conds []cond.Cond
	for _, arg := range args {
		// Flatten nested OR calls without incrementing depth.
		if call := arg.GetCallExpr(); call != nil && call.GetFunction() == filtering.FunctionOr {
			c, err := buildOrCond(call.GetArgs(), depth)
			if err != nil {
				return nil, err
			}
			if c != nil && !c.IsEmpty() {
				conds = append(conds, c)
			}
			continue
		}
		c, err := buildCond(arg, depth)
		if err != nil {
			return nil, err
		}
		if c != nil && !c.IsEmpty() {
			conds = append(conds, c)
		}
	}
	if len(conds) == 0 {
		return nil, nil
	}
	return cond.Or(conds...), nil
}

// buildComparisonCond builds a field comparison condition.
func buildComparisonCond(fn string, args []*expr.Expr) (cond.Cond, error) {
	if len(args) != 2 {
		return nil, fmt.Errorf("comparison requires exactly 2 arguments, got %d", len(args))
	}

	field, value, err := extractFieldAndConst(args[0], args[1])
	if err != nil {
		return nil, err
	}

	switch fn {
	case filtering.FunctionEquals:
		return cond.Eq(field, constantToInterface(value)), nil
	case filtering.FunctionNotEquals:
		return cond.Ne(field, constantToInterface(value)), nil
	case filtering.FunctionLessThan:
		return cond.Lt(field, constantToInterface(value)), nil
	case filtering.FunctionLessEquals:
		return cond.Lte(field, constantToInterface(value)), nil
	case filtering.FunctionGreaterThan:
		return cond.Gt(field, constantToInterface(value)), nil
	case filtering.FunctionGreaterEquals:
		return cond.Gte(field, constantToInterface(value)), nil
	}
	return nil, fmt.Errorf("unknown comparison operator: %s", fn)
}

// buildHasCond builds a substring match condition.
func buildHasCond(args []*expr.Expr) (cond.Cond, error) {
	if len(args) != 2 {
		return nil, fmt.Errorf("HAS requires exactly 2 arguments, got %d", len(args))
	}

	field, value, err := extractFieldAndConst(args[0], args[1])
	if err != nil {
		return nil, err
	}

	s, ok := constantToInterface(value).(string)
	if !ok {
		return nil, fmt.Errorf("HAS operator requires string value")
	}
	return cond.Has(field, s), nil
}

// constantToInterface converts a CEL constant to a Go interface{} value.
func constantToInterface(c *expr.Constant) interface{} {
	switch v := c.ConstantKind.(type) {
	case *expr.Constant_StringValue:
		return v.StringValue
	case *expr.Constant_Int64Value:
		return v.Int64Value
	case *expr.Constant_Uint64Value:
		return v.Uint64Value
	case *expr.Constant_DoubleValue:
		return v.DoubleValue
	case *expr.Constant_BoolValue:
		return v.BoolValue
	}
	return nil
}

// ── AccountGroup ─────────────────────────────────────────────────────────────

// ParseAccountGroupFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseAccountGroupFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, acctGroupDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── AccountGroupAssignment ───────────────────────────────────────────────────

// ParseAccountGroupAssignmentFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseAccountGroupAssignmentFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, acctGroupAssignmentDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── Budget ───────────────────────────────────────────────────────────────────

// ParseBudgetFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseBudgetFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, budgetDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── BudgetRevision ───────────────────────────────────────────────────────────

// ParseBudgetRevisionFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseBudgetRevisionFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, budgetRevisionDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── BudgetRevisionAccountValue ───────────────────────────────────────────────

// ParseBudgetRevisionAccountValueFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseBudgetRevisionAccountValueFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, budgetRevisionAccountValueDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── BudgetAccountValue ───────────────────────────────────────────────────────

// ParseBudgetAccountValueFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseBudgetAccountValueFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, budgetAccountValueDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── BudgetActualAccountValue ──────────────────────────────────────────────────

// ParseBudgetActualAccountValueFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseBudgetActualAccountValueFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, budgetActualAccountValueDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// BudgetActualAccountValueFilters holds the special filter parameters that are
// applied at the SQL level for BudgetActualAccountValue queries.
type BudgetActualAccountValueFilters struct {
	Budgets  []string
	DateFrom *time.Time
	DateTo   *time.Time
}

// ExtractBudgetActualAccountValueFilters parses the supported special filters
// (budget, document_date) out of a condition chain and returns the remaining
// account-level condition for in-memory evaluation.
func ExtractBudgetActualAccountValueFilters(c cond.Cond) (*BudgetActualAccountValueFilters, cond.Cond, error) {
	filters := &BudgetActualAccountValueFilters{}
	var extractErr error

	var extract func(c cond.Cond)
	extract = func(c cond.Cond) {
		if c == nil || c.IsEmpty() {
			return
		}
		if extractErr != nil {
			return
		}

		switch cc := c.(type) {
		case cond.FieldCond:
			s, ok := cc.Value.(string)
			if !ok {
				return
			}
			switch cc.Field {
			case "budget":
				if cc.Op == cond.OpEq {
					filters.Budgets = append(filters.Budgets, s)
				}
			case "document_date":
				d, err := time.Parse(time.DateOnly, s)
				if err != nil {
					extractErr = fmt.Errorf("invalid document_date %q: %w", s, err)
					return
				}
				switch cc.Op {
				case cond.OpEq:
					filters.DateFrom = &d
					filters.DateTo = &d
				case cond.OpGte, cond.OpGt:
					filters.DateFrom = &d
				case cond.OpLte, cond.OpLt:
					filters.DateTo = &d
				}
			}
		case cond.AndCond:
			for _, inner := range cc.Conds {
				extract(inner)
			}
		case cond.OrCond:
			for _, inner := range cc.Conds {
				extract(inner)
			}
		case cond.NotCond:
			extract(cc.Inner)
		}
	}
	extract(c)

	if extractErr != nil {
		return nil, nil, extractErr
	}

	accountCond := cond.Transform(c, func(field string, value interface{}) (string, interface{}, bool) {
		if field == "budget" || field == "document_date" {
			return "", nil, false
		}
		return field, value, true
	})
	if accountCond != nil && accountCond.IsEmpty() {
		accountCond = nil
	}

	return filters, accountCond, nil
}

// ── Organization ─────────────────────────────────────────────────────────────

// ParseOrganizationFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseOrganizationFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, organizationDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── LedgerYear ─────────────────────────────────────────────────────────────

// ParseLedgerYearFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseLedgerYearFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, ledgerYearDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── Transaction ──────────────────────────────────────────────────────────────

// ParseTransactionFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseTransactionFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, transactionDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── LedgerAccount ───────────────────────────────────────────────────────

// ParseLedgerAccountFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseLedgerAccountFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, ledgerAccountDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── TransactionAssignment ─────────────────────────────────────────────

// ParseTransactionAssignmentFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseTransactionAssignmentFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, transactionAssignmentDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── ReportTemplate ───────────────────────────────────────────────────────────

// ParseReportTemplateFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseReportTemplateFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, reportTemplateDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── Report ───────────────────────────────────────────────────────────────────

// ParseReportFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseReportFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, reportDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── User ──────────────────────────────────────────────────────────────────────

// ParseUserFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseUserFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, userDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── UserGroup (Group) ────────────────────────────────────────────────────────

// ParseUserGroupFilter parses an AIP-160 filter string into an abstract condition chain.
func ParseUserGroupFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, userGroupDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// ── AuditLogEntry ────────────────────────────────────────────────────────────

// ParseAuditLogEntryFilter parses an AIP-160 filter string into an abstract
// condition chain.
func ParseAuditLogEntryFilter(raw string) (cond.Cond, error) {
	f, err := parseWith(raw, auditLogEntryDecls)
	if err != nil || f == nil {
		return nil, err
	}
	return buildCond(f.CheckedExpr.GetExpr(), 0)
}

// AuditLogEntryFilters holds the filter parameters that are resolved to UUIDs
// at the service level instead of being applied as raw column conditions.
type AuditLogEntryFilters struct {
	// Actor is the actor resource name (users/{user}) from an equality filter.
	Actor string
	// Organization is the organization resource name (organizations/{org})
	// from an equality filter.
	Organization string
}

// ExtractAuditLogEntryFilters parses the supported resource-reference filters
// (actor, organization) out of a condition chain and returns the remaining
// condition for SQL evaluation.
func ExtractAuditLogEntryFilters(c cond.Cond) (*AuditLogEntryFilters, cond.Cond, error) {
	filters := &AuditLogEntryFilters{}

	var extract func(c cond.Cond) error
	extract = func(c cond.Cond) error {
		if c == nil || c.IsEmpty() {
			return nil
		}

		switch cc := c.(type) {
		case cond.FieldCond:
			s, ok := cc.Value.(string)
			if !ok {
				return nil
			}
			switch cc.Field {
			case "actor":
				if cc.Op != cond.OpEq {
					return fmt.Errorf("actor filter only supports equality")
				}
				filters.Actor = s
			case "organization":
				if cc.Op != cond.OpEq {
					return fmt.Errorf("organization filter only supports equality")
				}
				filters.Organization = s
			}
			return nil
		case cond.AndCond:
			for _, inner := range cc.Conds {
				if err := extract(inner); err != nil {
					return err
				}
			}
		case cond.OrCond:
			for _, inner := range cc.Conds {
				if err := extract(inner); err != nil {
					return err
				}
			}
		case cond.NotCond:
			if err := extract(cc.Inner); err != nil {
				return err
			}
		}
		return nil
	}
	if err := extract(c); err != nil {
		return nil, nil, err
	}

	remaining := cond.Transform(c, func(field string, value interface{}) (string, interface{}, bool) {
		if field == "actor" || field == "organization" {
			return "", nil, false
		}
		return field, value, true
	})
	if remaining != nil && remaining.IsEmpty() {
		remaining = nil
	}

	return filters, remaining, nil
}

// ── AST walker ───────────────────────────────────────────────────────────────

// fieldVisitor is called for each simple field comparison found in the AST.
// op is one of: =, !=, <, <=, >, >=, : (has).
type fieldVisitor func(field, op string, val *expr.Constant) error

// walkSimple traverses a CEL expression tree and calls visitor for each
// leaf comparison. AND/OR/NOT combinators are recursed into transparently.
// Only simple <ident> <op> <literal> and <literal> <op> <ident> forms are
// supported; anything else returns an error.
func walkSimple(e *expr.Expr, visit fieldVisitor) error {
	if e == nil {
		return nil
	}
	if call := e.GetCallExpr(); call != nil {
		fn := call.GetFunction()
		args := call.GetArgs()
		switch fn {
		case filtering.FunctionAnd, filtering.FunctionOr, filtering.FunctionFuzzyAnd:
			for _, a := range args {
				if err := walkSimple(a, visit); err != nil {
					return err
				}
			}
		case filtering.FunctionNot:
			if len(args) == 1 {
				return walkSimple(args[0], visit)
			}
		case filtering.FunctionEquals, filtering.FunctionNotEquals,
			filtering.FunctionLessThan, filtering.FunctionLessEquals,
			filtering.FunctionGreaterThan, filtering.FunctionGreaterEquals:
			if len(args) != 2 {
				return fmt.Errorf("expected 2 args for %s", fn)
			}
			field, val, err := extractFieldAndConst(args[0], args[1])
			if err != nil {
				return err
			}
			return visit(field, fn, val)
		case filtering.FunctionHas:
			if len(args) != 2 {
				return fmt.Errorf("expected 2 args for :")
			}
			field, val, err := extractFieldAndConst(args[0], args[1])
			if err != nil {
				return err
			}
			return visit(field, filtering.FunctionHas, val)
		default:
			return fmt.Errorf("unsupported filter function %q", fn)
		}
		return nil
	}
	if ident := e.GetIdentExpr(); ident != nil {
		// bare identifier — treat as boolean field = true
		return visit(ident.GetName(), filtering.FunctionEquals, &expr.Constant{
			ConstantKind: &expr.Constant_BoolValue{BoolValue: true},
		})
	}
	return nil
}

// extractFieldAndConst returns (fieldName, constant) from a pair of args
// in either order (field op const OR const op field).
func extractFieldAndConst(a, b *expr.Expr) (string, *expr.Constant, error) {
	fieldName, constVal, err := tryFieldConst(a, b)
	if err == nil {
		return fieldName, constVal, nil
	}
	// reversed
	fieldName, constVal, err = tryFieldConst(b, a)
	if err == nil {
		return fieldName, constVal, nil
	}
	return "", nil, fmt.Errorf("filter: expected (field op literal) expression")
}

func tryFieldConst(maybeField, maybeConst *expr.Expr) (string, *expr.Constant, error) {
	name := identName(maybeField)
	if name == "" {
		return "", nil, fmt.Errorf("not an ident")
	}
	name = toSnakeCase(name)

	if c := maybeConst.GetConstExpr(); c != nil {
		return name, c, nil
	}

	// RHS may itself be an ident for bool fields (e.g. bare "true"/"false" idents).
	if rName := identName(maybeConst); rName == "true" || rName == "false" {
		return name, &expr.Constant{ConstantKind: &expr.Constant_BoolValue{BoolValue: rName == "true"}}, nil
	}

	return "", nil, fmt.Errorf("not a const")
}

func identName(e *expr.Expr) string {
	if ident := e.GetIdentExpr(); ident != nil {
		return ident.GetName()
	}
	if sel := e.GetSelectExpr(); sel != nil {
		parent := identName(sel.GetOperand())
		if parent != "" {
			return parent + "." + sel.GetField()
		}
	}
	return ""
}

// toSnakeCase converts camelCase to snake_case for field name normalization.
func toSnakeCase(s string) string {
	var b strings.Builder
	for i, r := range s {
		if r >= 'A' && r <= 'Z' {
			if i > 0 {
				b.WriteByte('_')
			}
			b.WriteRune(r + 32)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}
