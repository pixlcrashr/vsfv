package xmlformat

import (
	"context"
	"fmt"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
)

// ExportRepositoryDependencies holds the repositories needed for export.
type ExportRepositoryDependencies struct {
	OrganizationRepo               *repository.OrganizationRepository
	AccountRepo                    *repository.AccountRepository
	AccountGroupRepo               *repository.AccountGroupRepository
	AccountGroupAssignmentRepo     *repository.AccountGroupAssignmentRepository
	BudgetRepo                     *repository.BudgetRepository
	BudgetAccountValueRepo         *repository.BudgetAccountValueRepository
	BudgetRevisionRepo             *repository.BudgetRevisionRepository
	BudgetRevisionAccountValueRepo *repository.BudgetRevisionAccountValueRepository
	LedgerAccountRepo              *repository.LedgerAccountRepository
	LedgerYearRepo                 *repository.LedgerYearRepository
	TransactionRepo                *repository.TransactionRepository
	TransactionAssignmentRepo      *repository.TransactionAssignmentRepository
}

// ExportOrganization exports all data for a single organization as an XML
// document, including the organization record itself.
func ExportOrganization(ctx context.Context, deps *ExportRepositoryDependencies, orgID uuid.UUID) (*Document, error) {
	org, err := deps.OrganizationRepo.GetByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get organization: %w", err)
	}

	allAccounts, _, err := deps.AccountRepo.List(ctx, repository.ListAccountsParams{
		OrganizationID: orgID,
		PageSize:       100000,
	})
	if err != nil {
		return nil, fmt.Errorf("list accounts: %w", err)
	}

	accByID := make(map[uuid.UUID]*model.Account, len(allAccounts))
	for _, a := range allAccounts {
		accByID[a.ID] = a
	}

	childrenOf := make(map[uuid.UUID][]*model.Account)
	var roots []*model.Account
	for _, a := range accByID {
		if !a.ParentAccountID.Valid {
			roots = append(roots, a)
		} else {
			childrenOf[a.ParentAccountID.UUID] = append(childrenOf[a.ParentAccountID.UUID], a)
		}
	}

	var buildAccountTree func(*model.Account) Account
	buildAccountTree = func(m *model.Account) Account {
		node := Account{
			ID:                 m.ID.String(),
			CustomID:           m.CustomID,
			DisplayName:        m.DisplayName,
			DisplayCode:        m.DisplayCode,
			DisplayDescription: m.DisplayDescription,
			IsContainer:        m.IsContainer,
			IsArchived:         m.IsArchived,
		}
		if m.ParentAccountID.Valid {
			node.ParentAccountID = m.ParentAccountID.UUID.String()
		}
		for _, c := range childrenOf[m.ID] {
			node.Children = append(node.Children, buildAccountTree(c))
		}
		return node
	}

	var docAccounts []Account
	for _, r := range roots {
		docAccounts = append(docAccounts, buildAccountTree(r))
	}

	accountGroups, _, err := deps.AccountGroupRepo.List(ctx, repository.ListAccountGroupsParams{
		OrganizationID: orgID,
		PageSize:       100000,
	})
	if err != nil {
		return nil, fmt.Errorf("list account groups: %w", err)
	}

	var docAccountGroups []AccountGroup
	for _, g := range accountGroups {
		assignments, _, err := deps.AccountGroupAssignmentRepo.List(ctx, repository.ListAccountGroupAssignmentsParams{
			AccountGroupID: g.ID,
			PageSize:       100000,
		})
		if err != nil {
			return nil, fmt.Errorf("list account group assignments: %w", err)
		}

		var asgs []AccountGroupAssignment
		for _, a := range assignments {
			asgs = append(asgs, AccountGroupAssignment{
				AccountID: a.AccountID.String(),
				Negate:    a.Negate,
			})
		}

		docAccountGroups = append(docAccountGroups, AccountGroup{
			ID:                 g.ID.String(),
			CustomID:           g.CustomID,
			DisplayName:        g.DisplayName,
			DisplayDescription: g.DisplayDescription,
			Assignments:        asgs,
		})
	}

	ledgerAccounts, _, err := deps.LedgerAccountRepo.List(ctx, repository.ListLedgerAccountsParams{
		PageSize: 100000,
	})
	if err != nil {
		return nil, fmt.Errorf("list ledger accounts: %w", err)
	}

	var docLedgerAccounts []LedgerAccount
	for _, la := range ledgerAccounts {
		if la.OrganizationID != orgID {
			continue
		}
		docLedgerAccounts = append(docLedgerAccounts, LedgerAccount{
			ID:                 la.ID.String(),
			CustomID:           la.CustomID,
			Code:               la.Code,
			AccountType:        accountTypeToString(la.AccountType),
			DisplayName:        la.DisplayName,
			DisplayDescription: la.DisplayDescription,
		})
	}

	ledgerYears, _, err := deps.LedgerYearRepo.List(ctx, repository.ListLedgerYearsParams{
		OrganizationID: orgID,
		PageSize:       100000,
	})
	if err != nil {
		return nil, fmt.Errorf("list ledger years: %w", err)
	}

	var docLedgerYears []LedgerYear
	for _, ly := range ledgerYears {
		docLedgerYears = append(docLedgerYears, LedgerYear{
			ID:       ly.ID.String(),
			CustomID: ly.CustomID,
			Year:     ly.Year,
			IsClosed: ly.IsClosed,
		})
	}

	budgets, _, err := deps.BudgetRepo.List(ctx, repository.ListBudgetsParams{
		OrganizationID: orgID,
		PageSize:       100000,
	})
	if err != nil {
		return nil, fmt.Errorf("list budgets: %w", err)
	}

	var docBudgets []Budget
	for _, b := range budgets {
		bavs, _, err := deps.BudgetAccountValueRepo.List(ctx, repository.ListBudgetAccountValuesParams{
			OrganizationID: orgID,
			BudgetID:       b.ID,
			PageSize:       100000,
		})
		if err != nil {
			return nil, fmt.Errorf("list budget account values: %w", err)
		}

		var baseValues []BudgetValue
		for _, v := range bavs {
			baseValues = append(baseValues, BudgetValue{
				AccountID: v.AccountID.String(),
				Value:     v.Value.String(),
			})
		}

		revisions, _, err := deps.BudgetRevisionRepo.List(ctx, repository.ListBudgetRevisionsParams{
			BudgetID: b.ID,
			PageSize: 100000,
		})
		if err != nil {
			return nil, fmt.Errorf("list budget revisions: %w", err)
		}

		var docRevisions []BudgetRevision
		for _, r := range revisions {
			ravs, _, err := deps.BudgetRevisionAccountValueRepo.List(ctx, repository.ListBudgetRevisionAccountValuesParams{
				BudgetRevisionID: r.ID,
				PageSize:         100000,
			})
			if err != nil {
				return nil, fmt.Errorf("list budget revision account values: %w", err)
			}

			var revValues []BudgetValue
			for _, v := range ravs {
				revValues = append(revValues, BudgetValue{
					AccountID: v.AccountID.String(),
					Value:     v.Value.String(),
				})
			}

			docRevisions = append(docRevisions, BudgetRevision{
				ID:                 r.ID.String(),
				CustomID:           r.CustomID,
				DisplayName:        r.DisplayName,
				DisplayDescription: r.DisplayDescription,
				Date:               r.Date.Format(DateLayout),
				AccountValues:      revValues,
			})
		}

		docBudgets = append(docBudgets, Budget{
			ID:                  b.ID.String(),
			CustomID:            b.CustomID,
			DisplayName:         b.DisplayName,
			DisplayDescription:  b.DisplayDescription,
			PeriodStart:         b.PeriodStart.Format(DateLayout),
			PeriodEnd:           b.PeriodEnd.Format(DateLayout),
			IsClosed:            b.IsClosed,
			IsPublished:         b.IsPublished,
			PublishActualValues: b.PublishActualValues,
			AccountValues:       baseValues,
			Revisions:           docRevisions,
		})
	}

	transactions, err := deps.TransactionRepo.List(ctx, repository.ListTransactionsParams{
		PageSize: 100000,
	})
	if err != nil {
		return nil, fmt.Errorf("list transactions: %w", err)
	}

	var docTransactions []Transaction
	for _, t := range transactions {
		if t.OrganizationID != orgID {
			continue
		}

		assignments, _, err := deps.TransactionAssignmentRepo.List(ctx, repository.ListTransactionAssignmentsParams{
			TransactionID: t.ID,
			PageSize:      100000,
		})
		if err != nil {
			return nil, fmt.Errorf("list transaction assignments: %w", err)
		}

		var asgs []TransactionAssignment
		for _, a := range assignments {
			asgs = append(asgs, TransactionAssignment{
				AccountID: a.AccountID.String(),
				Value:     a.Value.String(),
			})
		}

		docTransactions = append(docTransactions, Transaction{
			ID:                    t.ID.String(),
			CustomID:              t.CustomID,
			CreditLedgerAccountID: t.CreditLedgerAccountID.String(),
			DebitLedgerAccountID:  t.DebitLedgerAccountID.String(),
			Amount:                t.Amount.String(),
			Description:           t.Description,
			Reference:             t.Reference,
			BookedAt:              t.BookedAt.Format(DateLayout),
			DocumentDate:          t.DocumentDate.Format(DateLayout),
			Assignments:           asgs,
		})
	}

	return &Document{
		Version:    Version,
		ExportedAt: FormatExportedAt(),
		Organizations: []Organization{{
			ID:                 org.ID.String(),
			CustomID:           org.CustomID,
			DisplayName:        org.DisplayName,
			DisplayDescription: org.DisplayDescription,
			StartMonth:         int(org.StartMonth),
			Accounts:           docAccounts,
			AccountGroups:      docAccountGroups,
			LedgerAccounts:     docLedgerAccounts,
			LedgerYears:        docLedgerYears,
			Budgets:            docBudgets,
			Transactions:       docTransactions,
		}},
	}, nil
}

func accountTypeToString(t model.AccountType) string {
	switch t {
	case model.AccountTypeAsset:
		return "asset"
	case model.AccountTypeLiability:
		return "liability"
	case model.AccountTypeEquity:
		return "equity"
	case model.AccountTypeRevenue:
		return "revenue"
	case model.AccountTypeExpense:
		return "expense"
	case model.AccountTypeSystem:
		return "system"
	default:
		return "unspecified"
	}
}

func accountTypeFromString(s string) (model.AccountType, error) {
	switch s {
	case "asset":
		return model.AccountTypeAsset, nil
	case "liability":
		return model.AccountTypeLiability, nil
	case "equity":
		return model.AccountTypeEquity, nil
	case "revenue":
		return model.AccountTypeRevenue, nil
	case "expense":
		return model.AccountTypeExpense, nil
	case "system":
		return model.AccountTypeSystem, nil
	case "unspecified", "":
		return model.AccountTypeUnspecified, nil
	default:
		return 0, fmt.Errorf("unknown account type %q", s)
	}
}

// parseDecimal parses an apd.Decimal from a string.
func parseDecimal(s string) (apd.Decimal, error) {
	if s == "" {
		return *apd.New(0, 0), nil
	}
	d, _, err := apd.NewFromString(s)
	if err != nil {
		return apd.Decimal{}, err
	}
	return *d, nil
}

// makeExportRepositoryDependencies constructs the export repository set from
// the given database handle.
func makeExportRepositoryDependencies(db *gorm.DB) *ExportRepositoryDependencies {
	return &ExportRepositoryDependencies{
		OrganizationRepo:               repository.NewOrganizationRepository(db),
		AccountRepo:                    repository.NewAccountRepository(db),
		AccountGroupRepo:               repository.NewAccountGroupRepository(db),
		AccountGroupAssignmentRepo:     repository.NewAccountGroupAssignmentRepository(db),
		BudgetRepo:                     repository.NewBudgetRepository(db),
		BudgetAccountValueRepo:         repository.NewBudgetAccountValueRepository(db),
		BudgetRevisionRepo:             repository.NewBudgetRevisionRepository(db),
		BudgetRevisionAccountValueRepo: repository.NewBudgetRevisionAccountValueRepository(db),
		LedgerAccountRepo:              repository.NewLedgerAccountRepository(db),
		LedgerYearRepo:                 repository.NewLedgerYearRepository(db),
		TransactionRepo:                repository.NewTransactionRepository(db),
		TransactionAssignmentRepo:      repository.NewTransactionAssignmentRepository(db),
	}
}
