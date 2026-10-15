package main

import (
	"flag"
	"fmt"
	"log"
	"time"

	"github.com/cockroachdb/apd/v3"
	"github.com/google/uuid"
	"github.com/pixlcrashr/vsfv/pkg/authz"
	"github.com/pixlcrashr/vsfv/pkg/cfg"
	pkgdb "github.com/pixlcrashr/vsfv/pkg/db"
	"github.com/pixlcrashr/vsfv/pkg/db/model"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	cfgFile := flag.String("c", "", "config file (default: ./config.yaml)")
	force := flag.Bool("f", false, "wipe fixture data from a previously seeded database before seeding")
	flag.Parse()

	config, err := cfg.Load(*cfgFile)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	db, err := pkgdb.Connect(config.Database.DSN)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	db.Logger = db.Logger.LogMode(logger.Silent)

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("get underlying sql.DB: %v", err)
	}
	defer sqlDB.Close()

	// Seeding requires the schema to exist; bring it up to date first.
	if err := pkgdb.Run(sqlDB); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	enforcer, err := authz.NewEnforcer(db)
	if err != nil {
		log.Fatalf("create enforcer: %v", err)
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return seed(tx, enforcer, *force)
	}); err != nil {
		log.Fatalf("seed: %v", err)
	}
	log.Println("seed complete")
}

func dec(s string) apd.Decimal {
	var d apd.Decimal
	if _, _, err := d.SetString(s); err != nil {
		log.Fatalf("invalid decimal %q: %v", s, err)
	}
	return d
}

func date(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// fiscalYearStart returns the first day of the given fiscal year for an
// organization whose financial year starts in startMonth.
func fiscalYearStart(year int, startMonth time.Month) time.Time {
	return date(year, startMonth, 1)
}

// fiscalYearEnd returns the last day of the given fiscal year for an
// organization whose financial year starts in startMonth.
func fiscalYearEnd(year int, startMonth time.Month) time.Time {
	return date(year+1, startMonth, 1).AddDate(0, 0, -1)
}

func cr(db *gorm.DB, v any) error { return db.Create(v).Error }

func ptr[T any](v T) *T { return &v }

// reset removes all data inserted by previous seed runs, children first so
// foreign keys stay satisfied.
func reset(db *gorm.DB) error {
	log.Println("wiping existing fixture data")
	for _, m := range []any{
		&model.TransactionAssignment{},
		&model.Transaction_{},
		&model.BudgetRevisionAccountValue{},
		&model.BudgetRevision{},
		&model.BudgetAccountValue{},
		&model.Budget{},
		&model.AccountGroupAssignment{},
		&model.Account{},
		&model.AccountGroup{},
		&model.Report{},
		&model.ReportTemplate{},
		&model.LedgerAccount{},
		&model.LedgerYear{},
		&model.Organization{},
	} {
		if err := db.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(m).Error; err != nil {
			return err
		}
	}
	return nil
}

func seed(db *gorm.DB, enforcer *authz.Enforcer, force bool) error {
	// The fixtures assume a clean database: every insert is unconditional, so
	// a second run collides with unique constraints. Refuse on a seeded
	// database unless the caller asked for a reset.
	var orgCount int64
	if err := db.Model(&model.Organization{}).Count(&orgCount).Error; err != nil {
		return err
	}
	if orgCount > 0 && !force {
		return fmt.Errorf("database already contains %d organizations; run with -f to wipe fixture data before seeding", orgCount)
	}
	if orgCount > 0 {
		if err := reset(db); err != nil {
			return err
		}
	}

	// ── Organizations ────────────────────────────────────────────────────────
	// org1: Verein Musterstadt – a registered association (Verein), focuses on
	//       membership fees, event income, and operating expenses.
	// org2: Handwerk Süd GmbH – a small craft company, focuses on materials,
	//       wages, and customer invoices.
	// org1 uses a calendar-year fiscal year (January start).
	// org2 uses a July-start fiscal year (FY2025 = July 2025 – June 2026).
	org1 := &model.Organization{DisplayName: "Verein Musterstadt e.V.", StartMonth: time.January}
	org2 := &model.Organization{DisplayName: "Handwerk Süd GmbH", StartMonth: time.July}
	if err := cr(db, org1); err != nil {
		return err
	}
	if err := cr(db, org2); err != nil {
		return err
	}

	// ── Account Groups ───────────────────────────────────────────────────────
	// org1: association chart of accounts
	ag1 := &model.AccountGroup{OrganizationID: org1.ID, DisplayName: "Umlaufvermögen", DisplayDescription: "Kasse, Bank und kurzfristige Forderungen"}
	ag2 := &model.AccountGroup{OrganizationID: org1.ID, DisplayName: "Vereinseinnahmen", DisplayDescription: "Mitgliedsbeiträge und Veranstaltungserlöse"}
	ag3 := &model.AccountGroup{OrganizationID: org1.ID, DisplayName: "Vereinsausgaben", DisplayDescription: "Betriebskosten des Vereins"}
	// org2: craft-company chart of accounts
	ag4 := &model.AccountGroup{OrganizationID: org2.ID, DisplayName: "Anlagevermögen", DisplayDescription: "Maschinen und Fahrzeuge"}
	ag5 := &model.AccountGroup{OrganizationID: org2.ID, DisplayName: "Umsatzerlöse", DisplayDescription: "Erlöse aus Kundenaufträgen"}
	ag6 := &model.AccountGroup{OrganizationID: org2.ID, DisplayName: "Materialkosten", DisplayDescription: "Roh-, Hilfs- und Betriebsstoffe"}
	ag7 := &model.AccountGroup{OrganizationID: org2.ID, DisplayName: "Personalkosten", DisplayDescription: "Löhne und Gehälter"}
	ag8 := &model.AccountGroup{OrganizationID: org2.ID, DisplayName: "Liquidität", DisplayDescription: "Bankkonten und Kasse"}
	for _, v := range []any{ag1, ag2, ag3, ag4, ag5, ag6, ag7, ag8} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// ── Accounts ─────────────────────────────────────────────────────────────
	// org1 accounts
	acc1 := &model.Account{OrganizationID: org1.ID, DisplayName: "Kasse", DisplayCode: "1000", DisplayDescription: "Barkasse des Vereins", IsContainer: true}
	acc2 := &model.Account{OrganizationID: org1.ID, DisplayName: "Girokonto", DisplayCode: "1200", DisplayDescription: "Hauptbankkonto"}
	acc3 := &model.Account{OrganizationID: org1.ID, DisplayName: "Mitgliedsbeiträge", DisplayCode: "4000", DisplayDescription: "Jährliche Mitgliedsbeiträge"}
	acc4 := &model.Account{OrganizationID: org1.ID, DisplayName: "Veranstaltungserlöse", DisplayCode: "4100", DisplayDescription: "Einnahmen aus Vereinsveranstaltungen"}
	acc5 := &model.Account{OrganizationID: org1.ID, DisplayName: "Raummiete", DisplayCode: "6000", DisplayDescription: "Miete für Vereinsräume"}
	acc6 := &model.Account{OrganizationID: org1.ID, DisplayName: "Bürobedarf", DisplayCode: "6100", DisplayDescription: "Büromaterial und Druckkosten"}
	// org2 accounts
	acc7 := &model.Account{OrganizationID: org2.ID, DisplayName: "Geschäftskonto", DisplayCode: "1210", DisplayDescription: "Hauptgeschäftskonto"}
	acc8 := &model.Account{OrganizationID: org2.ID, DisplayName: "Maschinen", DisplayCode: "0200", DisplayDescription: "Produktionsmaschinen", IsContainer: true}
	acc9 := &model.Account{OrganizationID: org2.ID, DisplayName: "Fahrzeuge", DisplayCode: "0300", DisplayDescription: "Firmenfahrzeuge"}
	acc10 := &model.Account{OrganizationID: org2.ID, DisplayName: "Erlöse Aufträge", DisplayCode: "8000", DisplayDescription: "Erlöse aus Handwerkeraufträgen"}
	acc11 := &model.Account{OrganizationID: org2.ID, DisplayName: "Materialaufwand", DisplayCode: "5000", DisplayDescription: "Verbrauchtes Rohmaterial"}
	acc12 := &model.Account{OrganizationID: org2.ID, DisplayName: "Löhne und Gehälter", DisplayCode: "6200", DisplayDescription: "Bruttogehälter der Mitarbeiter"}
	for _, v := range []any{acc1, acc2, acc3, acc4, acc5, acc6, acc7, acc8, acc9, acc10, acc11, acc12} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// sub-accounts
	acc1a := &model.Account{
		OrganizationID:  org1.ID,
		ParentAccountID: uuid.NullUUID{Valid: true, UUID: acc1.ID},
		DisplayName:     "Handkasse",
		DisplayCode:     "1001",
	}
	acc8a := &model.Account{
		OrganizationID:  org2.ID,
		ParentAccountID: uuid.NullUUID{Valid: true, UUID: acc8.ID},
		DisplayName:     "Fräsmaschine",
		DisplayCode:     "0201",
	}
	for _, v := range []any{acc1a, acc8a} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// ── Account Group Assignments ────────────────────────────────────────────
	// org1
	for _, v := range []any{
		&model.AccountGroupAssignment{OrganizationID: org1.ID, AccountGroupID: ag1.ID, AccountID: acc1.ID},
		&model.AccountGroupAssignment{OrganizationID: org1.ID, AccountGroupID: ag1.ID, AccountID: acc2.ID},
		&model.AccountGroupAssignment{OrganizationID: org1.ID, AccountGroupID: ag2.ID, AccountID: acc3.ID},
		&model.AccountGroupAssignment{OrganizationID: org1.ID, AccountGroupID: ag2.ID, AccountID: acc4.ID},
		&model.AccountGroupAssignment{OrganizationID: org1.ID, AccountGroupID: ag3.ID, AccountID: acc5.ID},
		&model.AccountGroupAssignment{OrganizationID: org1.ID, AccountGroupID: ag3.ID, AccountID: acc6.ID},
	} {
		if err := cr(db, v); err != nil {
			return err
		}
	}
	// org2
	for _, v := range []any{
		&model.AccountGroupAssignment{OrganizationID: org2.ID, AccountGroupID: ag4.ID, AccountID: acc8.ID},
		&model.AccountGroupAssignment{OrganizationID: org2.ID, AccountGroupID: ag4.ID, AccountID: acc9.ID},
		&model.AccountGroupAssignment{OrganizationID: org2.ID, AccountGroupID: ag5.ID, AccountID: acc10.ID},
		&model.AccountGroupAssignment{OrganizationID: org2.ID, AccountGroupID: ag6.ID, AccountID: acc11.ID},
		&model.AccountGroupAssignment{OrganizationID: org2.ID, AccountGroupID: ag7.ID, AccountID: acc12.ID},
		&model.AccountGroupAssignment{OrganizationID: org2.ID, AccountGroupID: ag8.ID, AccountID: acc7.ID},
	} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// ── Budgets ──────────────────────────────────────────────────────────────
	// org1: two yearly budgets (calendar-year fiscal year, January start).
	// The 2024 one is closed.
	bud1 := &model.Budget{
		OrganizationID: org1.ID, DisplayName: "Vereinshaushalt 2024",
		PeriodStart: fiscalYearStart(2024, time.January), PeriodEnd: fiscalYearEnd(2024, time.January), IsClosed: true,
	}
	bud2 := &model.Budget{
		OrganizationID: org1.ID, DisplayName: "Vereinshaushalt 2025",
		PeriodStart: fiscalYearStart(2025, time.January), PeriodEnd: fiscalYearEnd(2025, time.January),
	}
	// org2: quarterly budgets within fiscal year 2025 (July 2025 – June 2026).
	// Q1 = Jul–Sep 2025, Q2 = Oct–Dec 2025.
	bud3 := &model.Budget{
		OrganizationID: org2.ID, DisplayName: "Betriebsplan Q1 FY2025",
		PeriodStart: date(2025, 7, 1), PeriodEnd: date(2025, 9, 30),
	}
	bud4 := &model.Budget{
		OrganizationID: org2.ID, DisplayName: "Betriebsplan Q2 FY2025",
		PeriodStart: date(2025, 10, 1), PeriodEnd: date(2025, 12, 31),
	}
	for _, v := range []any{bud1, bud2, bud3, bud4} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// ── Budget Account Values ────────────────────────────────────────────────
	for _, v := range []any{
		// org1 – bud1 (2024, closed)
		&model.BudgetAccountValue{OrganizationID: org1.ID, BudgetID: bud1.ID, AccountID: acc1a.ID, Value: dec("2000")},
		&model.BudgetAccountValue{OrganizationID: org1.ID, BudgetID: bud1.ID, AccountID: acc2.ID, Value: dec("8000")},
		&model.BudgetAccountValue{OrganizationID: org1.ID, BudgetID: bud1.ID, AccountID: acc3.ID, Value: dec("12000")},
		&model.BudgetAccountValue{OrganizationID: org1.ID, BudgetID: bud1.ID, AccountID: acc5.ID, Value: dec("3600")},
		// org1 – bud2 (2025)
		&model.BudgetAccountValue{OrganizationID: org1.ID, BudgetID: bud2.ID, AccountID: acc1a.ID, Value: dec("2500")},
		&model.BudgetAccountValue{OrganizationID: org1.ID, BudgetID: bud2.ID, AccountID: acc2.ID, Value: dec("10000")},
		&model.BudgetAccountValue{OrganizationID: org1.ID, BudgetID: bud2.ID, AccountID: acc3.ID, Value: dec("13500")},
		&model.BudgetAccountValue{OrganizationID: org1.ID, BudgetID: bud2.ID, AccountID: acc4.ID, Value: dec("5000")},
		&model.BudgetAccountValue{OrganizationID: org1.ID, BudgetID: bud2.ID, AccountID: acc5.ID, Value: dec("4200")},
		// org2 – bud3 (Q1 2025)
		&model.BudgetAccountValue{OrganizationID: org2.ID, BudgetID: bud3.ID, AccountID: acc10.ID, Value: dec("45000")},
		&model.BudgetAccountValue{OrganizationID: org2.ID, BudgetID: bud3.ID, AccountID: acc11.ID, Value: dec("18000")},
		&model.BudgetAccountValue{OrganizationID: org2.ID, BudgetID: bud3.ID, AccountID: acc12.ID, Value: dec("22000")},
		// org2 – bud4 (Q2 2025)
		&model.BudgetAccountValue{OrganizationID: org2.ID, BudgetID: bud4.ID, AccountID: acc10.ID, Value: dec("52000")},
		&model.BudgetAccountValue{OrganizationID: org2.ID, BudgetID: bud4.ID, AccountID: acc11.ID, Value: dec("20000")},
		&model.BudgetAccountValue{OrganizationID: org2.ID, BudgetID: bud4.ID, AccountID: acc12.ID, Value: dec("23000")},
	} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// ── Budget Revisions ─────────────────────────────────────────────────────
	rev1 := &model.BudgetRevision{
		OrganizationID: org1.ID, BudgetID: bud1.ID,
		DisplayName: "Jahresabschluss 2024", Date: date(2024, 12, 31),
	}
	rev2 := &model.BudgetRevision{
		OrganizationID: org1.ID, BudgetID: bud2.ID,
		DisplayName: "Halbjahresstand", Date: date(2025, 6, 30),
	}
	rev3 := &model.BudgetRevision{
		OrganizationID: org2.ID, BudgetID: bud3.ID,
		DisplayName: "Q1 Abschluss", Date: date(2025, 9, 30),
	}
	rev4 := &model.BudgetRevision{
		OrganizationID: org2.ID, BudgetID: bud4.ID,
		DisplayName: "Q2 Vorschau", Date: date(2025, 10, 15),
	}
	for _, v := range []any{rev1, rev2, rev3, rev4} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// ── Budget Revision Account Values ───────────────────────────────────────
	for _, v := range []any{
		&model.BudgetRevisionAccountValue{OrganizationID: org1.ID, BudgetID: bud1.ID, BudgetRevisionID: rev1.ID, AccountID: acc1a.ID, Value: dec("1850")},
		&model.BudgetRevisionAccountValue{OrganizationID: org1.ID, BudgetID: bud1.ID, BudgetRevisionID: rev1.ID, AccountID: acc2.ID, Value: dec("7600")},
		&model.BudgetRevisionAccountValue{OrganizationID: org1.ID, BudgetID: bud1.ID, BudgetRevisionID: rev1.ID, AccountID: acc3.ID, Value: dec("11800")},
		&model.BudgetRevisionAccountValue{OrganizationID: org1.ID, BudgetID: bud2.ID, BudgetRevisionID: rev2.ID, AccountID: acc1a.ID, Value: dec("2500")},
		&model.BudgetRevisionAccountValue{OrganizationID: org1.ID, BudgetID: bud2.ID, BudgetRevisionID: rev2.ID, AccountID: acc3.ID, Value: dec("7200")},
		&model.BudgetRevisionAccountValue{OrganizationID: org2.ID, BudgetID: bud3.ID, BudgetRevisionID: rev3.ID, AccountID: acc10.ID, Value: dec("43500")},
		&model.BudgetRevisionAccountValue{OrganizationID: org2.ID, BudgetID: bud3.ID, BudgetRevisionID: rev3.ID, AccountID: acc11.ID, Value: dec("17200")},
		&model.BudgetRevisionAccountValue{OrganizationID: org2.ID, BudgetID: bud3.ID, BudgetRevisionID: rev3.ID, AccountID: acc12.ID, Value: dec("21500")},
		&model.BudgetRevisionAccountValue{OrganizationID: org2.ID, BudgetID: bud4.ID, BudgetRevisionID: rev4.ID, AccountID: acc10.ID, Value: dec("50000")},
		&model.BudgetRevisionAccountValue{OrganizationID: org2.ID, BudgetID: bud4.ID, BudgetRevisionID: rev4.ID, AccountID: acc11.ID, Value: dec("19500")},
	} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// ── Ledger Years ────────────────────────────────────────────────
	// org1: calendar-year fiscal years (January start).
	// org2: July-start fiscal years. FY2024 = Jul 2024 – Jun 2025 (closed),
	//       FY2025 = Jul 2025 – Jun 2026 (open).
	for _, v := range []any{
		&model.LedgerYear{OrganizationID: org1.ID, Year: 2024, IsClosed: true},
		&model.LedgerYear{OrganizationID: org1.ID, Year: 2025},
		&model.LedgerYear{OrganizationID: org2.ID, Year: 2024, IsClosed: true},
		&model.LedgerYear{OrganizationID: org2.ID, Year: 2025},
	} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// ── Ledger Accounts ─────────────────────────────────────────────────
	// Bank/cash accounts carry the liquidity role; income/expense accounts
	// stay unmarked for the budget-plan value computation.
	// org1
	ta1 := &model.LedgerAccount{OrganizationID: org1.ID, Code: "1000", Type: ptr(model.LedgerAccountTypeLiquidity), DisplayName: "Kasse"}
	ta2 := &model.LedgerAccount{OrganizationID: org1.ID, Code: "1200", Type: ptr(model.LedgerAccountTypeLiquidity), DisplayName: "Girokonto"}
	ta3 := &model.LedgerAccount{OrganizationID: org1.ID, Code: "4000", DisplayName: "Mitgliedsbeiträge"}
	ta4 := &model.LedgerAccount{OrganizationID: org1.ID, Code: "4100", DisplayName: "Veranstaltungserlöse"}
	ta5 := &model.LedgerAccount{OrganizationID: org1.ID, Code: "6000", DisplayName: "Raummiete"}
	// org2
	ta6 := &model.LedgerAccount{OrganizationID: org2.ID, Code: "1210", Type: ptr(model.LedgerAccountTypeLiquidity), DisplayName: "Geschäftskonto"}
	ta7 := &model.LedgerAccount{OrganizationID: org2.ID, Code: "8000", DisplayName: "Erlöse Aufträge"}
	ta8 := &model.LedgerAccount{OrganizationID: org2.ID, Code: "5000", DisplayName: "Materialaufwand"}
	ta9 := &model.LedgerAccount{OrganizationID: org2.ID, Code: "6200", DisplayName: "Löhne und Gehälter"}
	for _, v := range []any{ta1, ta2, ta3, ta4, ta5, ta6, ta7, ta8, ta9} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// ── Transactions ─────────────────────────────────────────────────────────
	// org1 transactions (association) – fiscal year 2024 (Jan–Dec 2024)
	txOrg1 := []*model.Transaction_{
		{
			OrganizationID: org1.ID, CreditLedgerAccountID: ta2.ID, DebitLedgerAccountID: ta3.ID,
			Amount: dec("240.00"), Description: "Mitgliedsbeiträge Januar", Reference: "MB-2024-01",
			BookedAt: date(2024, 1, 5), DocumentDate: date(2024, 1, 5),
		},
		{
			OrganizationID: org1.ID, CreditLedgerAccountID: ta2.ID, DebitLedgerAccountID: ta4.ID,
			Amount: dec("1850.00"), Description: "Einnahmen Neujahrsfeier", Reference: "VE-2024-01",
			BookedAt: date(2024, 1, 20), DocumentDate: date(2024, 1, 19),
		},
		{
			OrganizationID: org1.ID, CreditLedgerAccountID: ta5.ID, DebitLedgerAccountID: ta2.ID,
			Amount: dec("600.00"), Description: "Miete Februar", Reference: "MIETE-2024-02",
			BookedAt: date(2024, 2, 1), DocumentDate: date(2024, 2, 1),
		},
		{
			OrganizationID: org1.ID, CreditLedgerAccountID: ta2.ID, DebitLedgerAccountID: ta3.ID,
			Amount: dec("240.00"), Description: "Mitgliedsbeiträge Februar", Reference: "MB-2024-02",
			BookedAt: date(2024, 2, 5), DocumentDate: date(2024, 2, 5),
		},
		{
			OrganizationID: org1.ID, CreditLedgerAccountID: ta1.ID, DebitLedgerAccountID: ta2.ID,
			Amount: dec("300.00"), Description: "Barabhebung für Veranstaltung", Reference: "BAR-2024-01",
			BookedAt: date(2024, 3, 10), DocumentDate: date(2024, 3, 10),
		},
		// org1 transactions – fiscal year 2025 (Jan–Dec 2025)
		{
			OrganizationID: org1.ID, CreditLedgerAccountID: ta2.ID, DebitLedgerAccountID: ta3.ID,
			Amount: dec("240.00"), Description: "Mitgliedsbeiträge Januar 2025", Reference: "MB-2025-01",
			BookedAt: date(2025, 1, 5), DocumentDate: date(2025, 1, 5),
		},
		{
			OrganizationID: org1.ID, CreditLedgerAccountID: ta2.ID, DebitLedgerAccountID: ta4.ID,
			Amount: dec("2100.00"), Description: "Einnahmen Neujahrsfeier 2025", Reference: "VE-2025-01",
			BookedAt: date(2025, 1, 20), DocumentDate: date(2025, 1, 19),
		},
		{
			OrganizationID: org1.ID, CreditLedgerAccountID: ta5.ID, DebitLedgerAccountID: ta2.ID,
			Amount: dec("600.00"), Description: "Miete Februar 2025", Reference: "MIETE-2025-02",
			BookedAt: date(2025, 2, 1), DocumentDate: date(2025, 2, 1),
		},
		{
			OrganizationID: org1.ID, CreditLedgerAccountID: ta2.ID, DebitLedgerAccountID: ta3.ID,
			Amount: dec("240.00"), Description: "Mitgliedsbeiträge Februar 2025", Reference: "MB-2025-02",
			BookedAt: date(2025, 2, 5), DocumentDate: date(2025, 2, 5),
		},
		{
			OrganizationID: org1.ID, CreditLedgerAccountID: ta1.ID, DebitLedgerAccountID: ta2.ID,
			Amount: dec("350.00"), Description: "Barabhebung für Veranstaltung 2025", Reference: "BAR-2025-01",
			BookedAt: date(2025, 3, 10), DocumentDate: date(2025, 3, 10),
		},
	}
	// org2 transactions (craft company) – fiscal year 2025 (Jul 2025 – Jun 2026).
	// All dates fall within Q1 FY2025 (Jul–Sep 2025).
	txOrg2 := []*model.Transaction_{
		{
			OrganizationID: org2.ID, CreditLedgerAccountID: ta7.ID, DebitLedgerAccountID: ta6.ID,
			Amount: dec("8500.00"), Description: "Rechnung Auftrag K-2025-01", Reference: "RE-2025-001",
			BookedAt: date(2025, 7, 10), DocumentDate: date(2025, 7, 8),
		},
		{
			OrganizationID: org2.ID, CreditLedgerAccountID: ta8.ID, DebitLedgerAccountID: ta6.ID,
			Amount: dec("3200.00"), Description: "Materialeinkauf Stahl", Reference: "EK-2025-001",
			BookedAt: date(2025, 7, 14), DocumentDate: date(2025, 7, 12),
		},
		{
			OrganizationID: org2.ID, CreditLedgerAccountID: ta9.ID, DebitLedgerAccountID: ta6.ID,
			Amount: dec("11000.00"), Description: "Lohnzahlung Juli", Reference: "LOHN-2025-07",
			BookedAt: date(2025, 7, 28), DocumentDate: date(2025, 7, 28),
		},
		{
			OrganizationID: org2.ID, CreditLedgerAccountID: ta7.ID, DebitLedgerAccountID: ta6.ID,
			Amount: dec("12400.00"), Description: "Rechnung Auftrag K-2025-02", Reference: "RE-2025-002",
			BookedAt: date(2025, 8, 7), DocumentDate: date(2025, 8, 5),
		},
		{
			OrganizationID: org2.ID, CreditLedgerAccountID: ta8.ID, DebitLedgerAccountID: ta6.ID,
			Amount: dec("4750.00"), Description: "Materialeinkauf Holz und Schrauben", Reference: "EK-2025-002",
			BookedAt: date(2025, 8, 11), DocumentDate: date(2025, 8, 10),
		},
		{
			OrganizationID: org2.ID, CreditLedgerAccountID: ta9.ID, DebitLedgerAccountID: ta6.ID,
			Amount: dec("11000.00"), Description: "Lohnzahlung August", Reference: "LOHN-2025-08",
			BookedAt: date(2025, 8, 27), DocumentDate: date(2025, 8, 27),
		},
	}

	// JournalKey is a per-organization dedup identifier with a unique index;
	// unset keys would collide on the second transaction of an organization.
	codes := map[uuid.UUID]string{}
	for _, ta := range []*model.LedgerAccount{ta1, ta2, ta3, ta4, ta5, ta6, ta7, ta8, ta9} {
		codes[ta.ID] = ta.Code
	}
	for _, tx := range append(txOrg1, txOrg2...) {
		tx.JournalKey = model.ComputeTransactionJournalKey(
			tx.BookedAt, tx.DocumentDate,
			codes[tx.CreditLedgerAccountID], codes[tx.DebitLedgerAccountID],
			tx.Amount, tx.Reference, tx.Description,
		)
	}
	for _, v := range txOrg1 {
		if err := cr(db, v); err != nil {
			return err
		}
	}
	for _, v := range txOrg2 {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// ── Transaction Account Assignments ──────────────────────────────────────
	// org1 – fiscal year 2024 transactions
	for _, pair := range [][2]any{
		{txOrg1[0].ID, acc3.ID}, // Mitgliedsbeiträge → acc3
		{txOrg1[1].ID, acc4.ID}, // Veranstaltungserlöse → acc4
		{txOrg1[2].ID, acc5.ID}, // Raummiete → acc5
		{txOrg1[3].ID, acc3.ID},
		{txOrg1[4].ID, acc1a.ID}, // Barabhebung → Handkasse (acc1a, leaf of acc1)
		// org1 – fiscal year 2025 transactions
		{txOrg1[5].ID, acc3.ID},
		{txOrg1[6].ID, acc4.ID},
		{txOrg1[7].ID, acc5.ID},
		{txOrg1[8].ID, acc3.ID},
		{txOrg1[9].ID, acc1a.ID},
	} {
		txID := pair[0].(uuid.UUID)
		acctID := pair[1].(uuid.UUID)
		txn := txOrg1[0]
		for _, t := range txOrg1 {
			if t.ID == txID {
				txn = t
				break
			}
		}
		if err := cr(db, &model.TransactionAssignment{
			OrganizationID: org1.ID, TransactionID: txID, AccountID: acctID, Value: txn.Amount,
		}); err != nil {
			return err
		}
	}
	// org2
	for _, pair := range [][2]any{
		{txOrg2[0].ID, acc10.ID}, // Erlöse
		{txOrg2[1].ID, acc11.ID}, // Material
		{txOrg2[2].ID, acc12.ID}, // Löhne
		{txOrg2[3].ID, acc10.ID},
		{txOrg2[4].ID, acc11.ID},
		{txOrg2[5].ID, acc12.ID},
	} {
		txID := pair[0].(uuid.UUID)
		acctID := pair[1].(uuid.UUID)
		txn := txOrg2[0]
		for _, t := range txOrg2 {
			if t.ID == txID {
				txn = t
				break
			}
		}
		if err := cr(db, &model.TransactionAssignment{
			OrganizationID: org2.ID, TransactionID: txID, AccountID: acctID, Value: txn.Amount,
		}); err != nil {
			return err
		}
	}

	// ── Report Templates ─────────────────────────────────────────────────────
	for _, v := range []any{
		&model.ReportTemplate{OrganizationID: org1.ID, DisplayName: "Monatsbericht Verein", Template: "# Monatsbericht\n\n## Einnahmen\n\n## Ausgaben"},
		&model.ReportTemplate{OrganizationID: org1.ID, DisplayName: "Jahresabschluss Verein", Template: "# Jahresabschluss\n\n## Bilanz\n\n## Ergebnis"},
		&model.ReportTemplate{OrganizationID: org2.ID, DisplayName: "Quartalsbericht", Template: "# Quartalsbericht\n\n## Umsatz\n\n## Kosten\n\n## Ergebnis"},
		&model.ReportTemplate{OrganizationID: org2.ID, DisplayName: "Auftragsübersicht", Template: "# Auftragsübersicht\n\n## Offene Aufträge\n\n## Erlöse"},
	} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	// ── Reports ──────────────────────────────────────────────────────────────
	for _, v := range []any{
		&model.Report{OrganizationID: org1.ID, DisplayName: "Januar 2024", Data: []byte("Monatsbericht Januar 2024 – Verein Musterstadt")},
		&model.Report{OrganizationID: org1.ID, DisplayName: "Jahresabschluss 2024", Data: []byte("Jahresabschluss 2024 – Verein Musterstadt")},
		&model.Report{OrganizationID: org2.ID, DisplayName: "Q1 FY2025", Data: []byte("Quartalsbericht Q1 FY2025 – Handwerk Süd GmbH")},
		&model.Report{OrganizationID: org2.ID, DisplayName: "Auftragsübersicht August 2025", Data: []byte("Offene und abgeschlossene Aufträge August 2025")},
	} {
		if err := cr(db, v); err != nil {
			return err
		}
	}

	return nil
}
