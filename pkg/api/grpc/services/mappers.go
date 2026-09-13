package services

import (
	"strings"
	"time"

	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"github.com/pixlcrashr/vsfv/pkg/db/repository"
	gen "github.com/pixlcrashr/vsfv/pkg/grpc/gen"
	gdate "google.golang.org/genproto/googleapis/type/date"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func decimalStr(s string) string {
	if strings.Contains(s, ".") {
		s = strings.TrimRight(s, "0")
		s = strings.TrimRight(s, ".")
	}
	return s
}

// ts converts time.Time → *timestamppb.Timestamp.
func ts(t time.Time) *timestamppb.Timestamp { return timestamppb.New(t) }

// dateProto converts time.Time → *google.type.Date (year/month/day only).
func dateProto(t time.Time) *gdate.Date {
	return &gdate.Date{
		Year:  int32(t.Year()),
		Month: int32(t.Month()),
		Day:   int32(t.Day()),
	}
}

// protoDateToTime converts *google.type.Date → time.Time (UTC midnight).
func protoDateToTime(d *gdate.Date) time.Time {
	if d == nil {
		return time.Time{}
	}
	return time.Date(int(d.Year), time.Month(d.Month), int(d.Day), 0, 0, 0, 0, time.UTC)
}

// OrganizationToProto maps a model.Organization to its proto representation.
func OrganizationToProto(m *model.Organization) *gen.Organization {
	return &gen.Organization{
		Name:               gen.OrganizationResourceName{Organization: m.CustomID}.String(),
		Uid:                m.ID.String(),
		DisplayName:        m.DisplayName,
		DisplayDescription: m.DisplayDescription,
		StartMonth:         gen.Month(m.StartMonth),
		UpdateTime:         ts(m.UpdatedAt),
		CreateTime:         ts(m.CreatedAt),
	}
}

// AccountToProto maps a model.Account to its proto representation.
func AccountToProto(orgRN gen.OrganizationResourceName, m *model.Account, pM *model.Account) *gen.Account {
	p := &gen.Account{
		Name:               orgRN.AccountResourceName(m.CustomID).String(),
		Uid:                m.ID.String(),
		DisplayName:        m.DisplayName,
		DisplayCode:        m.DisplayCode,
		DisplayDescription: m.DisplayDescription,
		IsContainer:        m.IsContainer,
		IsArchived:         m.IsArchived,
		UpdateTime:         ts(m.UpdatedAt),
		CreateTime:         ts(m.CreatedAt),
	}
	if m.ParentAccountID.Valid && pM != nil {
		p.ParentAccount = orgRN.AccountResourceName(pM.CustomID).String()
	}
	return p
}

func NestedAccountsToProto(orgRN gen.OrganizationResourceName, s []*accountWithChildren) []*gen.NestedAccount {
	out := make([]*gen.NestedAccount, 0, len(s))

	type frame struct {
		dest   *gen.NestedAccount
		src    []*accountWithChildren
		parent *model.Account
		idx    int
	}

	stack := make([]frame, 0, len(s))

	for i := 0; i < len(s); i++ {
		root := NestedAccountToProto(orgRN, s[i].account, nil)
		out = append(out, root)
		if len(s[i].children) > 0 {
			stack = append(stack, frame{dest: root, src: s[i].children, parent: s[i].account})
		}
	}

	for len(stack) > 0 {
		top := &stack[len(stack)-1]

		if top.idx >= len(top.src) {
			stack = stack[:len(stack)-1]
			continue
		}

		child := top.src[top.idx]
		top.idx++

		childProto := NestedAccountToProto(orgRN, child.account, top.parent)
		top.dest.Children = append(top.dest.Children, childProto)

		if len(child.children) > 0 {
			stack = append(stack, frame{dest: childProto, src: child.children, parent: child.account})
		}
	}

	return out
}

// NestedAccountToProto maps model.Account to gen.NestedAccount (without children; caller fills them).
func NestedAccountToProto(orgRN gen.OrganizationResourceName, m *model.Account, pM *model.Account) *gen.NestedAccount {
	p := &gen.NestedAccount{
		Account: AccountToProto(orgRN, m, pM),
	}
	if m.ParentAccountID.Valid && pM != nil {
		p.ParentAccount = orgRN.AccountResourceName(pM.CustomID).String()
	}
	return p
}

// AccountGroupToProto maps a model.AccountGroup to its proto representation.
func AccountGroupToProto(orgRN gen.OrganizationResourceName, m *model.AccountGroup) *gen.AccountGroup {
	return &gen.AccountGroup{
		Name:               orgRN.AccountGroupResourceName(m.CustomID).String(),
		Uid:                m.ID.String(),
		DisplayName:        m.DisplayName,
		DisplayDescription: m.DisplayDescription,
		UpdateTime:         ts(m.UpdatedAt),
		CreateTime:         ts(m.CreatedAt),
	}
}

// AccountGroupAssignmentToProto maps a model.AccountGroupAssignment to its proto representation.
func AccountGroupAssignmentToProto(groupRN gen.AccountGroupResourceName, m *model.AccountGroupAssignment) *gen.AccountGroupAssignment {
	return &gen.AccountGroupAssignment{
		Name:         groupRN.AccountGroupAssignmentResourceName(m.CustomID).String(),
		Uid:          m.ID.String(),
		AccountGroup: groupRN.String(),
		AccountId:    m.AccountID.String(),
		Negate:       m.Negate,
		UpdateTime:   ts(m.UpdatedAt),
		CreateTime:   ts(m.CreatedAt),
	}
}

// BudgetToProto maps a model.Budget to its proto representation.
func BudgetToProto(orgRN gen.OrganizationResourceName, m *model.Budget) *gen.Budget {
	p := &gen.Budget{
		Name:                orgRN.BudgetResourceName(m.CustomID).String(),
		Uid:                 m.ID.String(),
		DisplayName:         m.DisplayName,
		DisplayDescription:  m.DisplayDescription,
		IsClosed:            m.IsClosed,
		IsPublished:         m.IsPublished,
		PublishActualValues: m.PublishActualValues,
		PeriodStart:         dateProto(m.PeriodStart),
		PeriodEnd:           dateProto(m.PeriodEnd),
		UpdateTime:          ts(m.UpdatedAt),
		CreateTime:          ts(m.CreatedAt),
	}
	if m.PublishActualValuesUntil.Valid {
		p.PublishActualValuesUntil = dateProto(m.PublishActualValuesUntil.Time)
	}
	return p
}

// BudgetAccountValueToProto maps model.BudgetAccountValue to gen.BudgetAccountValue.
func BudgetAccountValueToProto(budgetRN gen.BudgetResourceName, m *model.BudgetAccountValue, account *model.Account) *gen.BudgetAccountValue {
	p := &gen.BudgetAccountValue{
		Name:       budgetRN.BudgetAccountValueResourceName(m.CustomID).String(),
		Uid:        m.ID.String(),
		Budget:     budgetRN.String(),
		Value:      &gen.Decimal{Value: decimalStr(m.Value.String())},
		UpdateTime: ts(m.UpdatedAt),
		CreateTime: ts(m.CreatedAt),
	}
	if account != nil {
		p.Account = gen.AccountResourceName{Organization: budgetRN.Organization, Account: account.CustomID}.String()
	}
	return p
}

// BudgetRevisionToProto maps model.BudgetRevision to gen.BudgetRevision.
func BudgetRevisionToProto(budgetRN gen.BudgetResourceName, m *model.BudgetRevision) *gen.BudgetRevision {
	return &gen.BudgetRevision{
		Name:               budgetRN.BudgetRevisionResourceName(m.CustomID).String(),
		Uid:                m.ID.String(),
		Budget:             budgetRN.String(),
		DisplayName:        m.DisplayName,
		DisplayDescription: m.DisplayDescription,
		IsPublished:        m.IsPublished,
		Date:               dateProto(m.Date),
		CreateTime:         ts(m.CreatedAt),
	}
}

// BudgetRevisionAccountValueToProto maps model.BudgetRevisionAccountValue to gen.BudgetRevisionAccountValue.
func BudgetRevisionAccountValueToProto(revisionRN gen.BudgetRevisionResourceName, m *model.BudgetRevisionAccountValue, account *model.Account) *gen.BudgetRevisionAccountValue {
	p := &gen.BudgetRevisionAccountValue{
		Name:       revisionRN.BudgetRevisionAccountValueResourceName(m.CustomID).String(),
		Uid:        m.ID.String(),
		Revision:   revisionRN.String(),
		Value:      &gen.Decimal{Value: decimalStr(m.Value.String())},
		CreateTime: ts(m.CreatedAt),
	}
	if account != nil {
		p.Account = gen.AccountResourceName{Organization: revisionRN.Organization, Account: account.CustomID}.String()
	}
	return p
}

// LedgerYearToProto maps a model.LedgerYear to its proto representation.
func LedgerYearToProto(orgRN gen.OrganizationResourceName, m *model.LedgerYear) *gen.LedgerYear {
	return &gen.LedgerYear{
		Name:       orgRN.LedgerYearResourceName(m.CustomID).String(),
		Uid:        m.ID.String(),
		Year:       int32(m.Year),
		IsClosed:   m.IsClosed,
		UpdateTime: ts(m.UpdatedAt),
		CreateTime: ts(m.CreatedAt),
	}
}

// TransactionToProto maps a model.Transaction_ to its proto representation.
func TransactionToProto(orgRN gen.OrganizationResourceName, m *model.Transaction_, creditLA *model.LedgerAccount, debitLA *model.LedgerAccount) *gen.Transaction {
	p := &gen.Transaction{
		Name:                orgRN.TransactionResourceName(m.ID.String()).String(),
		Uid:                 m.ID.String(),
		CreditLedgerAccount: orgRN.LedgerAccountResourceName(creditLA.CustomID).String(),
		DebitLedgerAccount:  orgRN.LedgerAccountResourceName(debitLA.CustomID).String(),
		Amount:              &gen.Decimal{Value: decimalStr(m.Amount.String())},
		Description:         m.Description,
		Reference:           m.Reference,
		BookedAt:            ts(m.BookedAt),
		DocumentDate:        ts(m.DocumentDate),
		UpdateTime:          ts(m.UpdatedAt),
		CreateTime:          ts(m.CreatedAt),
	}
	return p
}

// LedgerAccountToProto maps a model.LedgerAccount to its proto representation.
func LedgerAccountToProto(orgRN gen.OrganizationResourceName, m *model.LedgerAccount) *gen.LedgerAccount {
	return &gen.LedgerAccount{
		Name:               orgRN.LedgerAccountResourceName(m.CustomID).String(),
		Uid:                m.ID.String(),
		Code:               m.Code,
		AccountType:        gen.AccountType(m.AccountType),
		DisplayName:        m.DisplayName,
		DisplayDescription: m.DisplayDescription,
		UpdateTime:         ts(m.UpdatedAt),
		CreateTime:         ts(m.CreatedAt),
	}
}

// TransactionAssignmentToProto maps a model.TransactionAssignment to its proto representation.
func TransactionAssignmentToProto(txRN gen.TransactionResourceName, m *model.TransactionAssignment, account *model.Account) *gen.TransactionAssignment {
	return &gen.TransactionAssignment{
		Name:        txRN.TransactionAssignmentResourceName(m.ID.String()).String(),
		Uid:         m.ID.String(),
		Transaction: txRN.String(),
		Account:     gen.AccountResourceName{Organization: txRN.Organization, Account: account.CustomID}.String(),
		Value:       &gen.Decimal{Value: decimalStr(m.Value.String())},
		UpdateTime:  ts(m.UpdatedAt),
		CreateTime:  ts(m.CreatedAt),
	}
}

// ReportTemplateToProto maps a model.ReportTemplate to its proto representation.
func ReportTemplateToProto(orgRN gen.OrganizationResourceName, m *model.ReportTemplate) *gen.ReportTemplate {
	return &gen.ReportTemplate{
		Name:        orgRN.ReportTemplateResourceName(m.CustomID).String(),
		Uid:         m.ID.String(),
		DisplayName: m.DisplayName,
		Template:    m.Template,
		UpdateTime:  ts(m.UpdatedAt),
		CreateTime:  ts(m.CreatedAt),
	}
}

// ReportToProto maps a model.Report to its proto representation.
// Note: model.Report does not persist the template ID after generation;
// report_template_id is intentionally left empty here.
func ReportToProto(orgRN gen.OrganizationResourceName, m *model.Report) *gen.Report {
	return &gen.Report{
		Name:        orgRN.ReportResourceName(m.CustomID).String(),
		Uid:         m.ID.String(),
		DisplayName: m.DisplayName,
		CreateTime:  ts(m.CreatedAt),
	}
}

// UserToProto maps a model.User to its proto representation.
func UserToProto(m *model.User) *gen.User {
	p := &gen.User{
		Name:        gen.UserResourceName{User: m.ID.String()}.String(),
		Uid:         m.ID.String(),
		DisplayName: m.Name,
		Email:       m.Email,
		IsActive:    true,
		UpdateTime:  ts(m.UpdatedAt),
		CreateTime:  ts(m.CreatedAt),
	}
	if m.PictureURL.Valid {
		p.PictureUrl = m.PictureURL.String
	}
	return p
}

// UserIdentityToProto maps a model.UserIdentity to its proto representation.
func UserIdentityToProto(userRN gen.UserResourceName, m *model.UserIdentity) *gen.UserIdentity {
	return &gen.UserIdentity{
		Name:            userRN.UserIdentityResourceName(m.CustomID).String(),
		Uid:             m.ID.String(),
		Provider:        m.Provider,
		ProviderSubject: m.ProviderUserID,
		DisplayName:     "",
		Email:           "",
		CreateTime:      ts(m.CreatedAt),
	}
}

// UserSettingsToProto maps a model.UserSettings to its proto representation.
func UserSettingsToProto(userRN gen.UserResourceName, m *model.UserSettings) *gen.UserSettings {
	return &gen.UserSettings{
		Name:               userRN.UserSettingsResourceName().String(),
		Locale:             m.Locale,
		Theme:              m.Theme,
		EmailNotifications: m.EmailNotifications,
		UpdateTime:         ts(m.UpdatedAt),
	}
}

// UserGroupToProto maps a model.UserGroup to its proto representation.
func UserGroupToProto(m *model.UserGroup, organizations, permissions []string) *gen.Group {
	return &gen.Group{
		Name:               gen.GroupResourceName{Group: m.CustomID}.String(),
		Uid:                m.ID.String(),
		DisplayName:        m.Name,
		DisplayDescription: m.Description,
		Organizations:      organizations,
		Permissions:        permissions,
		IsSystem:           m.IsSystem,
		UpdateTime:         ts(m.UpdatedAt),
		CreateTime:         ts(m.CreatedAt),
	}
}

// BudgetActualAccountValueToProto maps a computed ActualAccountValue to its
// proto representation.
func BudgetActualAccountValueToProto(budgetRN gen.BudgetResourceName, m *repository.ActualAccountValue) *gen.BudgetActualAccountValue {
	return &gen.BudgetActualAccountValue{
		Name:    budgetRN.BudgetActualAccountValueResourceName(m.AccountCustomID).String(),
		Account: gen.AccountResourceName{Organization: budgetRN.Organization, Account: m.AccountCustomID}.String(),
		Budget:  budgetRN.String(),
		Value:   &gen.Decimal{Value: decimalStr(m.Value.String())},
	}
}
